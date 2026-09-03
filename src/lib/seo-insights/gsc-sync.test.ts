import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";

/**
 * Sincronización de Search Console.
 *
 * `planSyncWindow` es pura y se prueba sola. `runGscSync` se prueba con la base
 * y el CLIENTE de GSC mockeados: nunca se llama a Google de verdad desde un
 * test — ni siquiera a través del guard de egress.
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
  seoSyncRuns: { id: {}, siteId: {}, startedAt: {} },
}));

import { planSyncWindow, runGscSync, MAX_DAYS_PER_RUN } from "./gsc-sync";
import { GSC_LAG_DAYS, GSC_REFRESH_DAYS } from "./config";

const TODAY = new Date("2026-09-03T10:00:00Z");
/** Último día con datos completos: hoy − retraso de Search Console. */
const LAG_END = "2026-08-31";

describe("planSyncWindow — función pura", () => {
  test("el plan nunca pide días más recientes que el retraso de Search Console", () => {
    const plan = planSyncWindow({ earliestStored: "2025-01-01", today: TODAY });
    expect(plan.end).toBe(LAG_END);
    expect(GSC_LAG_DAYS).toBe(3);
  });

  test("tabla vacía → backfill, acotado a MAX_DAYS_PER_RUN y con hasMore", () => {
    const plan = planSyncWindow({ earliestStored: null, today: TODAY });
    expect(plan.mode).toBe("backfill");
    expect(plan.days.length).toBe(MAX_DAYS_PER_RUN);
    expect(plan.hasMore).toBe(true);
    // Arranca 16 meses atrás desde el último día completo. 2026-08-31 menos 16
    // meses cae en un "31 de abril" que JS normaliza al 1 de mayo — un día de
    // holgura en el límite del backfill, irrelevante porque Search Console solo
    // conserva 16 meses de todos modos.
    expect(plan.start).toBe("2025-05-01");
  });

  test("historia incompleta → sigue rellenando hacia atrás, de lo más reciente a lo más viejo", () => {
    const plan = planSyncWindow({ earliestStored: "2026-06-01", today: TODAY });
    expect(plan.mode).toBe("backfill");
    // El tramo pendiente termina el día ANTERIOR al más antiguo guardado.
    expect(plan.end).toBe("2026-05-31");
    expect(plan.days.length).toBe(MAX_DAYS_PER_RUN);
    expect(plan.hasMore).toBe(true);
  });

  test("último tramo del backfill: sin hasMore", () => {
    const plan = planSyncWindow({ earliestStored: "2026-06-01", today: TODAY, maxDaysPerRun: 10_000 });
    expect(plan.mode).toBe("backfill");
    expect(plan.hasMore).toBe(false);
    expect(plan.start).toBe("2025-05-01");
  });

  test("historia completa → incremental de los últimos GSC_REFRESH_DAYS días", () => {
    const plan = planSyncWindow({ earliestStored: "2024-01-01", today: TODAY });
    expect(plan.mode).toBe("incremental");
    expect(plan.days.length).toBe(GSC_REFRESH_DAYS);
    expect(plan.end).toBe(LAG_END);
    expect(plan.start).toBe("2026-08-27");
    expect(plan.hasMore).toBe(false);
  });

  test("es determinista: la misma entrada da siempre el mismo plan", () => {
    const a = planSyncWindow({ earliestStored: "2024-01-01", today: TODAY });
    const b = planSyncWindow({ earliestStored: "2024-01-01", today: new Date("2026-09-03T23:59:00Z") });
    expect(a).toEqual(b);
  });
});

describe("runGscSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(TODAY);
    orderLimitMock.mockResolvedValue([{ date: "2024-01-01" }]);
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

  test("tabla vacía → arranca el backfill", async () => {
    orderLimitMock.mockResolvedValue([]);
    const result = await runWithTimers();
    expect(result.mode).toBe("backfill");
    expect(result.days).toBe(MAX_DAYS_PER_RUN);
    expect(result.hasMore).toBe(true);
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
