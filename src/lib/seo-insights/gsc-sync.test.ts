import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";

/**
 * Sincronización de Search Console.
 *
 * `planSyncWindow` es pura y se prueba sola. `runGscSync` se prueba con la base
 * y el CLIENTE de GSC mockeados: nunca se llama a Google de verdad desde un
 * test — ni siquiera a través del guard de egress.
 *
 * WO-2026-00218: el progreso se mide con un CURSOR hacia adelante
 * (`latestBackfilled`, el último día ya cubierto por una corrida exitosa en
 * `seo_sync_runs`), no con la fecha más antigua guardada en `gsc_page_daily`.
 * El diseño anterior confundía "llegamos al extremo más viejo" con "backfill
 * terminado" y una ventana con 0 filas reales (resultado válido de la API, no
 * un fallo) nunca dejaba rastro en la tabla de datos — el plan se congelaba
 * en la misma ventana para siempre. Reproducido en producción real: 10
 * corridas seguidas del cron devolvieron la ventana 2025-05-01..2025-06-14
 * sin avanzar, y una simulación secuencial con datos reales mostró que
 * incluso escribiendo filas, el diseño anterior saltaba de la primera ventana
 * directo a "incremental", perdiéndose ~14 de los 16 meses de historia.
 */

const { queryMock, insertValuesMock, onConflictUpdateMock, returningMock, updateWhereMock, orderLimitMock } =
  vi.hoisted(() => ({
    queryMock: vi.fn(),
    insertValuesMock: vi.fn(),
    onConflictUpdateMock: vi.fn(async (_arg: { target: unknown[]; set: Record<string, unknown> }) => undefined),
    returningMock: vi.fn(async () => [{ id: "run-1" }]),
    updateWhereMock: vi.fn(async () => undefined),
    orderLimitMock: vi.fn(),
  }));

vi.mock("@/lib/google/gsc-egress", () => ({
  querySearchAnalytics: queryMock,
  GSC_ROW_LIMIT: 25_000,
  isGscConfigured: () => true,
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({ limit: orderLimitMock })),
          limit: orderLimitMock,
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: insertValuesMock.mockReturnValue({
        onConflictDoUpdate: onConflictUpdateMock,
        returning: returningMock,
      }),
    })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: updateWhereMock })) })),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  gscPageDaily: { siteId: {}, date: {}, page: {} },
  gscQueryDaily: { siteId: {}, date: {}, page: {}, query: {} },
  seoSyncRuns: { id: {}, siteId: {}, source: {}, status: {}, windowStart: {}, windowEnd: {}, startedAt: {} },
}));

import { planSyncWindow, runGscSync, MAX_DAYS_PER_RUN } from "./gsc-sync";
import { GSC_LAG_DAYS, GSC_REFRESH_DAYS } from "./config";

const TODAY = new Date("2026-09-03T10:00:00Z");
/** Último día con datos completos: hoy − retraso de Search Console. */
const LAG_END = "2026-08-31";
/** Primer día del backfill: 16 meses atrás desde LAG_END. */
const BACKFILL_START = "2025-05-01";

describe("planSyncWindow — función pura", () => {
  test("cursor null (nunca corrió) → backfill desde el extremo más viejo, acotado a MAX_DAYS_PER_RUN", () => {
    const plan = planSyncWindow({ latestBackfilled: null, today: TODAY });
    expect(plan.mode).toBe("backfill");
    expect(plan.days.length).toBe(MAX_DAYS_PER_RUN);
    expect(plan.hasMore).toBe(true);
    // Arranca 16 meses atrás desde el último día completo. 2026-08-31 menos 16
    // meses cae en un "31 de abril" que JS normaliza al 1 de mayo — un día de
    // holgura en el límite del backfill, irrelevante porque Search Console solo
    // conserva 16 meses de todos modos.
    expect(plan.start).toBe(BACKFILL_START);
  });

  test("backfill en progreso → retoma el día siguiente al cursor, nunca repite ni retrocede", () => {
    const plan = planSyncWindow({ latestBackfilled: "2025-06-14", today: TODAY });
    expect(plan.mode).toBe("backfill");
    expect(plan.start).toBe("2025-06-15");
    expect(plan.days.length).toBe(MAX_DAYS_PER_RUN);
    expect(plan.hasMore).toBe(true);
  });

  test("WO-2026-00218: una ventana con 0 filas reales avanza el cursor igual — el bug reproducido en producción", () => {
    // El bug real: 10 corridas seguidas con `latestBackfilled` re-derivado de
    // `gsc_page_daily` (vacía, 0 filas) devolvían siempre la misma ventana. Con
    // el cursor basado en `seo_sync_runs.window_end`, cada corrida SÍ avanza
    // aunque la anterior no haya escrito una sola fila — se simula aquí
    // encadenando `plan.end` de una corrida como `latestBackfilled` de la
    // siguiente, exactamente como hace `runGscSync` vía la consulta a
    // `seo_sync_runs` (probado por separado en el describe de abajo).
    let latestBackfilled: string | null = null;
    const starts = new Set<string>();
    for (let i = 0; i < 12; i += 1) {
      const plan = planSyncWindow({ latestBackfilled, today: TODAY });
      if (plan.mode !== "backfill") break;
      expect(starts.has(plan.start!)).toBe(false); // nunca repite una ventana ya vista
      starts.add(plan.start!);
      latestBackfilled = plan.end;
    }
    // 16 meses ÷ 45 días/corrida ≈ 11 tandas — todas distintas, cubriendo desde
    // el extremo más viejo hasta el retraso de Search Console sin huecos.
    expect(starts.size).toBeGreaterThanOrEqual(10);
    expect([...starts][0]).toBe(BACKFILL_START);
  });

  test("último tramo del backfill: sin hasMore, aterriza exactamente en el retraso de Search Console", () => {
    const plan = planSyncWindow({ latestBackfilled: "2025-06-14", today: TODAY, maxDaysPerRun: 10_000 });
    expect(plan.mode).toBe("backfill");
    expect(plan.hasMore).toBe(false);
    expect(plan.end).toBe(LAG_END);
  });

  test("backfill completo (cursor alcanzó el retraso) → modo incremental de los últimos GSC_REFRESH_DAYS días", () => {
    const plan = planSyncWindow({ latestBackfilled: LAG_END, today: TODAY });
    expect(plan.mode).toBe("incremental");
    expect(plan.days.length).toBe(GSC_REFRESH_DAYS);
    expect(plan.end).toBe(LAG_END);
    expect(plan.start).toBe("2026-08-27");
    expect(plan.hasMore).toBe(false);
    expect(GSC_LAG_DAYS).toBe(3);
  });

  test("es determinista: la misma entrada da siempre el mismo plan", () => {
    const a = planSyncWindow({ latestBackfilled: LAG_END, today: TODAY });
    const b = planSyncWindow({ latestBackfilled: LAG_END, today: new Date("2026-09-03T23:59:00Z") });
    expect(a).toEqual(b);
  });
});

describe("runGscSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(TODAY);
    // `latestRun` viene de `seo_sync_runs` (lo YA INTENTADO, status=ok), no de
    // `gsc_page_daily` (lo YA ESCRITO) — WO-2026-00218. Por defecto: backfill
    // ya completo, para no repetir el detalle del backfill en cada test que no
    // lo necesita.
    orderLimitMock.mockResolvedValue([{ end: LAG_END }]);
    returningMock.mockResolvedValue([{ id: "run-1" }]);
    queryMock.mockResolvedValue([]);
    process.env.GSC_SITE_URL = "sc-domain:pixeltec.mx";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function runWithTimers() {
    const promise = runGscSync(TODAY);
    await vi.runAllTimersAsync();
    return promise;
  }

  test("modo incremental: pide page y page+query de cada día refrescado", async () => {
    const result = await runWithTimers();

    expect(result.mode).toBe("incremental");
    expect(result.days).toBe(GSC_REFRESH_DAYS);
    // 2 conjuntos de dimensiones por día.
    expect(queryMock).toHaveBeenCalledTimes(GSC_REFRESH_DAYS * 2);
    expect(queryMock.mock.calls.map((c) => c[0].dimensions)).toContainEqual(["page"]);
    expect(queryMock.mock.calls.map((c) => c[0].dimensions)).toContainEqual(["page", "query"]);
  });

  test("registra la corrida en seo_sync_runs y la cierra con ok", async () => {
    queryMock.mockResolvedValue([
      { keys: ["/blog/uno", "consulta"], clicks: 3, impressions: 40, ctr: 0.075, position: 6.1 },
    ]);
    const result = await runWithTimers();

    // La primera inserción es la fila de la bitácora.
    expect(insertValuesMock.mock.calls[0][0]).toMatchObject({ source: "gsc", status: "running" });
    expect(updateWhereMock).toHaveBeenCalled();
    expect(result.rows).toBe(GSC_REFRESH_DAYS * 2);
  });

  test("upsert, no insert: un día re-traído sobrescribe lo que Google corrigió", async () => {
    queryMock.mockResolvedValue([
      { keys: ["/blog/uno"], clicks: 1, impressions: 10, ctr: 0.1, position: 3 },
    ]);
    await runWithTimers();
    expect(onConflictUpdateMock).toHaveBeenCalled();
    const arg = onConflictUpdateMock.mock.calls[0][0];
    expect(Array.isArray(arg.target)).toBe(true);
    expect(arg.set).toHaveProperty("clicks");
  });

  test("nunca corrió antes → arranca el backfill en el extremo más viejo", async () => {
    orderLimitMock.mockResolvedValue([]);
    const result = await runWithTimers();
    expect(result.mode).toBe("backfill");
    expect(result.start).toBe(BACKFILL_START);
    expect(result.days).toBe(MAX_DAYS_PER_RUN);
    expect(result.hasMore).toBe(true);
  });

  test("WO-2026-00218: una ventana de backfill con 0 filas reales no atasca la siguiente corrida", async () => {
    // Reproduce el bug real de producción: la API responde 0 filas (impresiones
    // reales cero en ese período, resultado válido) — nada que insertar en
    // gsc_page_daily, pero `seo_sync_runs` SÍ debe reflejar que esa ventana ya
    // se intentó (vía `windowEnd`), para que la corrida siguiente pida la
    // ventana de al lado en vez de repetir la misma.
    orderLimitMock.mockResolvedValueOnce([]); // 1ª corrida: nunca corrió antes.
    queryMock.mockResolvedValue([]); // Google responde 0 filas reales.
    const first = await runWithTimers();
    expect(first.mode).toBe("backfill");
    expect(first.start).toBe(BACKFILL_START);
    expect(first.rows).toBe(0);

    // 2ª corrida: el SELECT sobre seo_sync_runs ahora devuelve el `windowEnd`
    // de la corrida anterior (simulando que quedó persistida con status=ok) —
    // no depende de que gsc_page_daily tenga una sola fila.
    vi.clearAllMocks();
    orderLimitMock.mockResolvedValueOnce([{ end: first.end }]);
    queryMock.mockResolvedValue([]);
    returningMock.mockResolvedValue([{ id: "run-2" }]);
    const second = await runWithTimers();
    expect(second.mode).toBe("backfill");
    expect(second.start).not.toBe(first.start);
    expect(new Date(second.start!).getTime()).toBeGreaterThan(new Date(first.end!).getTime());
  });

  test("un fallo de Google marca la corrida como error y se propaga", async () => {
    queryMock.mockRejectedValueOnce(new Error("gsc_http_403"));
    const promise = runGscSync(TODAY);
    const assertion = expect(promise).rejects.toThrow("gsc_http_403");
    await vi.runAllTimersAsync();
    await assertion;
    expect(updateWhereMock).toHaveBeenCalled();
  });
});
