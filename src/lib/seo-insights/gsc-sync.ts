import { desc, asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { gscPageDaily, gscQueryDaily, seoSyncRuns } from "@/lib/db/schema";
import { querySearchAnalytics, GSC_ROW_LIMIT, type GscRow } from "@/lib/google/gsc-egress";
import {
  GSC_BACKFILL_MONTHS,
  GSC_LAG_DAYS,
  GSC_PROPERTY,
  GSC_REFRESH_DAYS,
  SITE_ID,
} from "./config";
import { addDays, toDateKey } from "./period";

/**
 * Sincronización de Search Console (WO-2026-00214).
 *
 * Dos modos, decididos por el ESTADO de la tabla y no por un flag: si falta
 * historia se rellena hacia atrás; si ya está completa se refrescan los últimos
 * días. Un flag manual acabaría desincronizado del estado real de los datos.
 *
 * Por qué se refrescan los últimos días en vez de sólo añadir el más reciente:
 * Search Console tiene 2-3 días de retraso y **reescribe** datos ya publicados
 * durante unos días más. Un `INSERT` de una sola pasada dejaría congelados
 * números que Google después corrigió.
 *
 * Por qué el backfill va POR TANDAS y no de una: 16 meses son ~490 días × 2
 * conjuntos de dimensiones × paginación. Hacerlo en una sola corrida sería una
 * petición HTTP de decenas de minutos que cualquier timeout mata a la mitad,
 * dejando huecos silenciosos. Cada corrida avanza `MAX_DAYS_PER_RUN` días y la
 * siguiente continúa desde donde quedó — el plan se deduce de qué hay guardado,
 * así que reanudar es automático y no necesita estado propio.
 *
 * Diseño: docs/superpowers/specs/2026-09-03-seo-contenido-design.md
 */

/** Días que una corrida procesa como máximo. El resto continúa mañana. */
export const MAX_DAYS_PER_RUN = 45;

/** Pausa entre llamadas a la API. No es cortesía: es no agotar la cuota diaria. */
export const THROTTLE_MS = 250;

export type SyncMode = "backfill" | "incremental" | "up_to_date";

export interface SyncPlan {
  mode: SyncMode;
  /** Días `YYYY-MM-DD` a pedir, en orden. Vacío si `up_to_date`. */
  days: string[];
  /** Primer día del plan, o `null`. */
  start: string | null;
  /** Último día del plan, o `null`. */
  end: string | null;
  /** `true` si quedan días pendientes de backfill para la siguiente corrida. */
  hasMore: boolean;
}

export interface PlanInput {
  /** Día más antiguo ya guardado para el sitio, o `null` si la tabla está vacía. */
  earliestStored: string | null;
  today: Date;
  maxDaysPerRun?: number;
}

function enumerateDays(start: string, end: string): string[] {
  const days: string[] = [];
  let cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor.getTime() <= last.getTime()) {
    days.push(toDateKey(cursor));
    cursor = addDays(cursor, 1);
  }
  return days;
}

function monthsBefore(date: Date, months: number): Date {
  const out = new Date(date.getTime());
  out.setUTCMonth(out.getUTCMonth() - months);
  return out;
}

/**
 * Qué días hay que pedir. Función PURA — el estado de la tabla y la fecha se
 * inyectan, así que el plan se puede testear entero sin base de datos y sin
 * congelar el reloj.
 */
export function planSyncWindow(input: PlanInput): SyncPlan {
  const cap = input.maxDaysPerRun ?? MAX_DAYS_PER_RUN;
  // Search Console no tiene datos completos de los últimos días. Pedirlos
  // devolvería ceros que después habría que corregir.
  const lagEnd = toDateKey(addDays(input.today, -GSC_LAG_DAYS));
  const backfillStart = toDateKey(monthsBefore(addDays(input.today, -GSC_LAG_DAYS), GSC_BACKFILL_MONTHS));

  const empty: SyncPlan = { mode: "up_to_date", days: [], start: null, end: null, hasMore: false };

  // Tabla vacía: todo el histórico, por tandas.
  if (input.earliestStored === null) {
    const all = enumerateDays(backfillStart, lagEnd);
    if (all.length === 0) return empty;
    const days = all.slice(0, cap);
    return {
      mode: "backfill",
      days,
      start: days[0],
      end: days[days.length - 1],
      hasMore: all.length > days.length,
    };
  }

  // Historia incompleta hacia atrás: se sigue rellenando antes de refrescar.
  if (input.earliestStored > backfillStart) {
    const gapEnd = toDateKey(addDays(new Date(`${input.earliestStored}T00:00:00Z`), -1));
    const pending = enumerateDays(backfillStart, gapEnd);
    if (pending.length > 0) {
      // Los más recientes primero: si el backfill nunca llega a terminar, al
      // menos lo que sí se trajo es lo más útil para las ventanas de 28 días.
      const days = pending.slice(-cap);
      return {
        mode: "backfill",
        days,
        start: days[0],
        end: days[days.length - 1],
        hasMore: pending.length > days.length,
      };
    }
  }

  // Historia completa: se refrescan los últimos días (reescritura de Google).
  const refreshStart = toDateKey(addDays(new Date(`${lagEnd}T00:00:00Z`), -(GSC_REFRESH_DAYS - 1)));
  const days = enumerateDays(refreshStart, lagEnd);
  if (days.length === 0) return empty;
  return {
    mode: "incremental",
    days,
    start: days[0],
    end: days[days.length - 1],
    hasMore: false,
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Todas las filas de un día para un conjunto de dimensiones, paginando.
 * Se detiene cuando una página vuelve incompleta: es el fin de los datos.
 */
async function fetchAllRows(day: string, dimensions: ("page" | "query")[]): Promise<GscRow[]> {
  const out: GscRow[] = [];
  let startRow = 0;

  // Techo defensivo: 40 páginas × 25 000 = 1 000 000 filas de un solo día.
  // Si alguna vez se alcanzara, algo va mal y es mejor cortar que iterar sin fin.
  for (let page = 0; page < 40; page += 1) {
    const rows = await querySearchAnalytics({
      siteUrl: GSC_PROPERTY,
      startDate: day,
      endDate: day,
      dimensions,
      rowLimit: GSC_ROW_LIMIT,
      startRow,
    });
    out.push(...rows);
    if (rows.length < GSC_ROW_LIMIT) break;
    startRow += rows.length;
    await sleep(THROTTLE_MS);
  }
  return out;
}

export interface SyncResult {
  mode: SyncMode;
  start: string | null;
  end: string | null;
  days: number;
  rows: number;
  hasMore: boolean;
}

/**
 * Ejecuta una corrida. Registra SIEMPRE en `seo_sync_runs` — también los
 * fallos: sin bitácora, un backfill que muere a la mitad es invisible.
 */
export async function runGscSync(now: Date = new Date()): Promise<SyncResult> {
  const [earliest] = await db
    .select({ date: gscPageDaily.date })
    .from(gscPageDaily)
    .where(eq(gscPageDaily.siteId, SITE_ID))
    .orderBy(asc(gscPageDaily.date))
    .limit(1);

  const plan = planSyncWindow({ earliestStored: earliest?.date ?? null, today: now });

  if (plan.mode === "up_to_date" || plan.days.length === 0) {
    return { mode: "up_to_date", start: null, end: null, days: 0, rows: 0, hasMore: false };
  }

  const [run] = await db
    .insert(seoSyncRuns)
    .values({
      siteId: SITE_ID,
      source: "gsc",
      windowStart: plan.start,
      windowEnd: plan.end,
      status: "running",
    })
    .returning({ id: seoSyncRuns.id });

  let written = 0;
  try {
    for (const day of plan.days) {
      const pageRows = await fetchAllRows(day, ["page"]);
      for (const row of pageRows) {
        await db
          .insert(gscPageDaily)
          .values({
            siteId: SITE_ID,
            date: day,
            page: row.keys[0] ?? "",
            clicks: row.clicks,
            impressions: row.impressions,
            ctr: row.ctr,
            position: row.position,
            fetchedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [gscPageDaily.siteId, gscPageDaily.date, gscPageDaily.page],
            set: {
              clicks: row.clicks,
              impressions: row.impressions,
              ctr: row.ctr,
              position: row.position,
              fetchedAt: new Date(),
            },
          });
        written += 1;
      }

      await sleep(THROTTLE_MS);

      const queryRows = await fetchAllRows(day, ["page", "query"]);
      for (const row of queryRows) {
        await db
          .insert(gscQueryDaily)
          .values({
            siteId: SITE_ID,
            date: day,
            page: row.keys[0] ?? "",
            query: row.keys[1] ?? "",
            clicks: row.clicks,
            impressions: row.impressions,
            ctr: row.ctr,
            position: row.position,
            fetchedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [gscQueryDaily.siteId, gscQueryDaily.date, gscQueryDaily.page, gscQueryDaily.query],
            set: {
              clicks: row.clicks,
              impressions: row.impressions,
              ctr: row.ctr,
              position: row.position,
              fetchedAt: new Date(),
            },
          });
        written += 1;
      }

      await sleep(THROTTLE_MS);
    }

    await db
      .update(seoSyncRuns)
      .set({ status: "ok", rows: written, finishedAt: new Date() })
      .where(eq(seoSyncRuns.id, run.id));

    return {
      mode: plan.mode,
      start: plan.start,
      end: plan.end,
      days: plan.days.length,
      rows: written,
      hasMore: plan.hasMore,
    };
  } catch (err) {
    // Sólo el mensaje, recortado: los errores del cliente de GSC ya son códigos
    // estables (`gsc_http_403`) y jamás llevan el cuerpo del proveedor.
    const code = err instanceof Error ? err.message.slice(0, 200) : "unknown_error";
    await db
      .update(seoSyncRuns)
      .set({ status: "error", rows: written, error: code, finishedAt: new Date() })
      .where(eq(seoSyncRuns.id, run.id));
    throw err;
  }
}

/** Última corrida registrada, para mostrar el estado en la UI. */
export async function getLastSyncRun() {
  const [row] = await db
    .select()
    .from(seoSyncRuns)
    .where(eq(seoSyncRuns.siteId, SITE_ID))
    .orderBy(desc(seoSyncRuns.startedAt))
    .limit(1);
  return row ?? null;
}

/** `true` si hay al menos un snapshot de Search Console guardado. */
export async function hasGscData(): Promise<boolean> {
  const [row] = await db
    .select({ n: sql<number>`1` })
    .from(gscPageDaily)
    .where(eq(gscPageDaily.siteId, SITE_ID))
    .limit(1);
  return Boolean(row);
}
