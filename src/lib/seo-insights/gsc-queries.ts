import { and, eq, gte, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { gscPageDaily, gscQueryDaily } from "@/lib/db/schema";
import { SITE_ID } from "./config";
import { splitBrandQueries, type QueryRow } from "./brand-filter";
import { normalizeContentPath } from "./config";
import type { ComparisonWindows } from "./period";

/**
 * Lecturas de Search Console para el dashboard (WO-2026-00219, Fase 2).
 *
 * La propiedad de Search Console (`sc-domain:pixeltec.mx`) es de DOMINIO: cubre
 * http/https, `www` y TODOS los subdominios en una sola — incluido
 * `encino.pixeltec.mx` (Muebles Encino), que comparte el mismo `site_id` en
 * estas tablas porque `gsc-sync.ts` etiqueta cada fila con la constante
 * `SITE_ID`, no con el host real de la URL. Sin filtrar por host aquí, las
 * cifras de pixeltec.mx incluirían tráfico de otro proyecto — verificado en
 * vivo: la fila con más impresiones de `gsc_page_daily` hoy es de
 * `encino.pixeltec.mx`, no de este sitio.
 */

/** Predicado SQL: solo `pixeltec.mx` (con o sin `www`), nunca un subdominio. */
function ownDomainSql(pageColumn: typeof gscPageDaily.page | typeof gscQueryDaily.page): SQL {
  return sql`(
    ${pageColumn} like 'https://pixeltec.mx/%' or ${pageColumn} = 'https://pixeltec.mx'
    or ${pageColumn} like 'https://www.pixeltec.mx/%' or ${pageColumn} = 'https://www.pixeltec.mx'
  )`;
}

/** Quita el origen (`https://pixeltec.mx` o `https://www.pixeltec.mx`) de una URL de GSC. */
export function pathFromGscPage(page: string): string {
  const withoutOrigin = page.replace(/^https:\/\/(www\.)?pixeltec\.mx/i, "");
  return normalizeContentPath(withoutOrigin === "" ? "/" : withoutOrigin);
}

export interface GscSum {
  impressions: number;
  clicks: number;
}

export interface GscKpis {
  impressions: { current: number; previous: number };
  impressionsNonBrand: { current: number; previous: number };
  clicks: { current: number; previous: number };
  /** `null` sin impresiones — un 0% ahí significaría "nadie hace clic", que es distinto de "no lo sé". */
  ctr: { current: number | null; previous: number | null };
  /** Consultas con impresiones en la ventana actual y CERO en la anterior. */
  newQueries: number;
}

function toNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function ctrOf(clicks: number, impressions: number): number | null {
  return impressions === 0 ? null : clicks / impressions;
}

/** Impresiones/clics totales de `pixeltec.mx` por ventana, sin desglosar por consulta. */
async function pageTotals(windows: ComparisonWindows): Promise<{
  impressionsCurrent: number;
  clicksCurrent: number;
  impressionsPrevious: number;
  clicksPrevious: number;
}> {
  const [row] = await db
    .select({
      impressionsCurrent: sql<number>`coalesce(sum(${gscPageDaily.impressions}) filter (where ${gscPageDaily.date} >= ${windows.current.start} and ${gscPageDaily.date} <= ${windows.current.end}), 0)`,
      clicksCurrent: sql<number>`coalesce(sum(${gscPageDaily.clicks}) filter (where ${gscPageDaily.date} >= ${windows.current.start} and ${gscPageDaily.date} <= ${windows.current.end}), 0)`,
      impressionsPrevious: sql<number>`coalesce(sum(${gscPageDaily.impressions}) filter (where ${gscPageDaily.date} >= ${windows.previous.start} and ${gscPageDaily.date} <= ${windows.previous.end}), 0)`,
      clicksPrevious: sql<number>`coalesce(sum(${gscPageDaily.clicks}) filter (where ${gscPageDaily.date} >= ${windows.previous.start} and ${gscPageDaily.date} <= ${windows.previous.end}), 0)`,
    })
    .from(gscPageDaily)
    .where(and(eq(gscPageDaily.siteId, SITE_ID), ownDomainSql(gscPageDaily.page), gte(gscPageDaily.date, windows.previous.start)));
  return {
    impressionsCurrent: toNumber(row?.impressionsCurrent),
    clicksCurrent: toNumber(row?.clicksCurrent),
    impressionsPrevious: toNumber(row?.impressionsPrevious),
    clicksPrevious: toNumber(row?.clicksPrevious),
  };
}

interface QueryAgg extends QueryRow {
  impressionsPrevious: number;
}

/** Impresiones/clics agrupados por CONSULTA (no por página), las dos ventanas a la vez. */
async function queryTotals(windows: ComparisonWindows): Promise<QueryAgg[]> {
  const rows = await db
    .select({
      query: gscQueryDaily.query,
      impressions: sql<number>`coalesce(sum(${gscQueryDaily.impressions}) filter (where ${gscQueryDaily.date} >= ${windows.current.start} and ${gscQueryDaily.date} <= ${windows.current.end}), 0)`,
      clicks: sql<number>`coalesce(sum(${gscQueryDaily.clicks}) filter (where ${gscQueryDaily.date} >= ${windows.current.start} and ${gscQueryDaily.date} <= ${windows.current.end}), 0)`,
      impressionsPrevious: sql<number>`coalesce(sum(${gscQueryDaily.impressions}) filter (where ${gscQueryDaily.date} >= ${windows.previous.start} and ${gscQueryDaily.date} <= ${windows.previous.end}), 0)`,
    })
    .from(gscQueryDaily)
    .where(and(eq(gscQueryDaily.siteId, SITE_ID), ownDomainSql(gscQueryDaily.page), gte(gscQueryDaily.date, windows.previous.start)))
    .groupBy(gscQueryDaily.query);
  return rows.map((r) => ({
    query: r.query,
    impressions: toNumber(r.impressions),
    clicks: toNumber(r.clicks),
    impressionsPrevious: toNumber(r.impressionsPrevious),
  }));
}

/**
 * KPIs de nivel superior del panel: impresiones (totales y no-marca), clics,
 * CTR y consultas nuevas. `null` en todo cuando Search Console no tiene datos
 * todavía — la pantalla decide qué mostrar en ese caso, esta función no.
 */
export async function getGscKpis(windows: ComparisonWindows): Promise<GscKpis | null> {
  const [pages, queries] = await Promise.all([pageTotals(windows), queryTotals(windows)]);
  if (pages.impressionsCurrent === 0 && pages.impressionsPrevious === 0 && queries.length === 0) return null;

  const { generic: genericCurrent } = splitBrandQueries(queries.map((q) => ({ query: q.query, clicks: q.clicks, impressions: q.impressions })));
  const { generic: genericPrevious } = splitBrandQueries(
    queries.map((q) => ({ query: q.query, clicks: 0, impressions: q.impressionsPrevious })),
  );
  const impressionsNonBrandCurrent = genericCurrent.reduce((sum, r) => sum + r.impressions, 0);
  const impressionsNonBrandPrevious = genericPrevious.reduce((sum, r) => sum + r.impressions, 0);

  const newQueries = queries.filter((q) => q.impressions > 0 && q.impressionsPrevious === 0).length;

  return {
    impressions: { current: pages.impressionsCurrent, previous: pages.impressionsPrevious },
    impressionsNonBrand: { current: impressionsNonBrandCurrent, previous: impressionsNonBrandPrevious },
    clicks: { current: pages.clicksCurrent, previous: pages.clicksPrevious },
    ctr: {
      current: ctrOf(pages.clicksCurrent, pages.impressionsCurrent),
      previous: ctrOf(pages.clicksPrevious, pages.impressionsPrevious),
    },
    newQueries,
  };
}

export interface GscPageWindowMetrics extends GscSum {
  ctr: number | null;
  /** Promedio ponderado por impresiones dentro de la ventana. `null` sin impresiones. */
  position: number | null;
}

/**
 * Métricas de GSC por PATH de contenido (no por URL cruda), agregando todas
 * las URLs de `pixeltec.mx`/`www.pixeltec.mx` que normalizan al mismo path
 * (`https://pixeltec.mx/blog/x` y `https://www.pixeltec.mx/blog/x` cuentan
 * como el mismo contenido). Devuelve un mapa `path -> {current, previous}`;
 * un path ausente del mapa significa "sin impresiones en ninguna ventana",
 * no "sin datos" — eso último lo decide `hasGscData()` a nivel de pantalla.
 */
export async function getGscByPath(
  windows: ComparisonWindows,
): Promise<Map<string, { current: GscPageWindowMetrics; previous: GscPageWindowMetrics }>> {
  const rows = await db
    .select({
      page: gscPageDaily.page,
      impressionsCurrent: sql<number>`coalesce(sum(${gscPageDaily.impressions}) filter (where ${gscPageDaily.date} >= ${windows.current.start} and ${gscPageDaily.date} <= ${windows.current.end}), 0)`,
      clicksCurrent: sql<number>`coalesce(sum(${gscPageDaily.clicks}) filter (where ${gscPageDaily.date} >= ${windows.current.start} and ${gscPageDaily.date} <= ${windows.current.end}), 0)`,
      positionWeightedCurrent: sql<number>`coalesce(sum(${gscPageDaily.position} * ${gscPageDaily.impressions}) filter (where ${gscPageDaily.date} >= ${windows.current.start} and ${gscPageDaily.date} <= ${windows.current.end}), 0)`,
      impressionsPrevious: sql<number>`coalesce(sum(${gscPageDaily.impressions}) filter (where ${gscPageDaily.date} >= ${windows.previous.start} and ${gscPageDaily.date} <= ${windows.previous.end}), 0)`,
      clicksPrevious: sql<number>`coalesce(sum(${gscPageDaily.clicks}) filter (where ${gscPageDaily.date} >= ${windows.previous.start} and ${gscPageDaily.date} <= ${windows.previous.end}), 0)`,
      positionWeightedPrevious: sql<number>`coalesce(sum(${gscPageDaily.position} * ${gscPageDaily.impressions}) filter (where ${gscPageDaily.date} >= ${windows.previous.start} and ${gscPageDaily.date} <= ${windows.previous.end}), 0)`,
    })
    .from(gscPageDaily)
    .where(and(eq(gscPageDaily.siteId, SITE_ID), ownDomainSql(gscPageDaily.page), gte(gscPageDaily.date, windows.previous.start)))
    .groupBy(gscPageDaily.page);

  const byPath = new Map<
    string,
    { impressionsCurrent: number; clicksCurrent: number; positionWeightedCurrent: number; impressionsPrevious: number; clicksPrevious: number; positionWeightedPrevious: number }
  >();
  for (const r of rows) {
    const path = pathFromGscPage(r.page);
    const prev = byPath.get(path) ?? {
      impressionsCurrent: 0,
      clicksCurrent: 0,
      positionWeightedCurrent: 0,
      impressionsPrevious: 0,
      clicksPrevious: 0,
      positionWeightedPrevious: 0,
    };
    byPath.set(path, {
      impressionsCurrent: prev.impressionsCurrent + toNumber(r.impressionsCurrent),
      clicksCurrent: prev.clicksCurrent + toNumber(r.clicksCurrent),
      positionWeightedCurrent: prev.positionWeightedCurrent + toNumber(r.positionWeightedCurrent),
      impressionsPrevious: prev.impressionsPrevious + toNumber(r.impressionsPrevious),
      clicksPrevious: prev.clicksPrevious + toNumber(r.clicksPrevious),
      positionWeightedPrevious: prev.positionWeightedPrevious + toNumber(r.positionWeightedPrevious),
    });
  }

  const out = new Map<string, { current: GscPageWindowMetrics; previous: GscPageWindowMetrics }>();
  for (const [path, agg] of byPath) {
    out.set(path, {
      current: {
        impressions: agg.impressionsCurrent,
        clicks: agg.clicksCurrent,
        ctr: ctrOf(agg.clicksCurrent, agg.impressionsCurrent),
        position: agg.impressionsCurrent === 0 ? null : agg.positionWeightedCurrent / agg.impressionsCurrent,
      },
      previous: {
        impressions: agg.impressionsPrevious,
        clicks: agg.clicksPrevious,
        ctr: ctrOf(agg.clicksPrevious, agg.impressionsPrevious),
        position: agg.impressionsPrevious === 0 ? null : agg.positionWeightedPrevious / agg.impressionsPrevious,
      },
    });
  }
  return out;
}
