import { gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { contentEvents, leads } from "@/lib/db/schema";
import { KEYWORD_LANDINGS } from "@/lib/content/keyword-landings";
import { getPublishedPosts } from "@/lib/blog/queries/posts";
import { READ_DEPTH } from "@/lib/analytics/events";
import { SITE_ID, WINDOW_DAYS } from "./config";
import { buildComparisonWindows, delta, type ComparisonWindows, type Delta } from "./period";
import { contentRole, landingRole, type ContentRole } from "./classify";

/**
 * Lecturas del módulo SEO & Contenido (WO-2026-00214).
 *
 * Sin datos de Search Console todavía: esta capa sólo agrega `content_events` y
 * `leads`. Las columnas de GSC de la pantalla muestran un estado vacío explícito
 * — un cero ahí haría que un contenido sano pareciera muerto.
 *
 * Diseño: docs/superpowers/specs/2026-09-03-seo-contenido-design.md
 */

export interface ContentMetrics {
  views: number;
  reads: number;
  ctaClicks: number;
  leads: number;
  qualified: number;
}

export interface ContentRow {
  path: string;
  title: string;
  kind: "blog" | "landing";
  role: ContentRole;
  current: ContentMetrics;
  previous: ContentMetrics;
  deltas: Record<keyof ContentMetrics, Delta>;
}

export interface ContentOverview {
  windows: ComparisonWindows;
  rows: ContentRow[];
  totals: { current: ContentMetrics; previous: ContentMetrics };
  /** `true` mientras no haya ningún snapshot de Search Console. */
  searchConsoleConnected: boolean;
}

const ZERO: ContentMetrics = { views: 0, reads: 0, ctaClicks: 0, leads: 0, qualified: 0 };

/** Inicio del día (UTC) de una clave `YYYY-MM-DD`. */
function dayStart(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

/** Instante inmediatamente posterior al último día incluido. */
function dayAfterEnd(key: string): Date {
  const d = new Date(`${key}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

/**
 * Agregados de `content_events` por path, para las dos ventanas a la vez.
 *
 * Una sola consulta con `FILTER` en vez de dos: recorrer la tabla dos veces
 * para comparar dos periodos contiguos duplica el trabajo sin ganar nada.
 */
async function eventTotals(windows: ComparisonWindows) {
  const curFrom = dayStart(windows.current.start);
  const curTo = dayAfterEnd(windows.current.end);
  const prevFrom = dayStart(windows.previous.start);

  const rows = await db
    .select({
      path: contentEvents.path,
      viewsCurrent: sql<number>`count(*) filter (where ${contentEvents.event} = 'view' and ${contentEvents.createdAt} >= ${curFrom} and ${contentEvents.createdAt} < ${curTo})`,
      viewsPrevious: sql<number>`count(*) filter (where ${contentEvents.event} = 'view' and ${contentEvents.createdAt} < ${curFrom})`,
      readsCurrent: sql<number>`count(*) filter (where ${contentEvents.event} = 'scroll' and (${contentEvents.meta}->>'depth')::int >= ${READ_DEPTH} and ${contentEvents.createdAt} >= ${curFrom} and ${contentEvents.createdAt} < ${curTo})`,
      readsPrevious: sql<number>`count(*) filter (where ${contentEvents.event} = 'scroll' and (${contentEvents.meta}->>'depth')::int >= ${READ_DEPTH} and ${contentEvents.createdAt} < ${curFrom})`,
      ctaCurrent: sql<number>`count(*) filter (where ${contentEvents.event} = 'cta_click' and ${contentEvents.createdAt} >= ${curFrom} and ${contentEvents.createdAt} < ${curTo})`,
      ctaPrevious: sql<number>`count(*) filter (where ${contentEvents.event} = 'cta_click' and ${contentEvents.createdAt} < ${curFrom})`,
    })
    .from(contentEvents)
    .where(gte(contentEvents.createdAt, prevFrom))
    .groupBy(contentEvents.path);

  return new Map(rows.map((r) => [r.path, r]));
}

/** Leads atribuidos a cada contenido, por su `first_content_path`. */
async function leadTotals(windows: ComparisonWindows) {
  const curFrom = dayStart(windows.current.start);
  const curTo = dayAfterEnd(windows.current.end);
  const prevFrom = dayStart(windows.previous.start);

  const rows = await db
    .select({
      path: leads.firstContentPath,
      leadsCurrent: sql<number>`count(*) filter (where ${leads.createdAt} >= ${curFrom} and ${leads.createdAt} < ${curTo})`,
      leadsPrevious: sql<number>`count(*) filter (where ${leads.createdAt} < ${curFrom})`,
      qualifiedCurrent: sql<number>`count(*) filter (where ${leads.qualifiedAt} is not null and ${leads.createdAt} >= ${curFrom} and ${leads.createdAt} < ${curTo})`,
      qualifiedPrevious: sql<number>`count(*) filter (where ${leads.qualifiedAt} is not null and ${leads.createdAt} < ${curFrom})`,
    })
    .from(leads)
    .where(gte(leads.createdAt, prevFrom))
    .groupBy(leads.firstContentPath);

  return new Map(rows.filter((r) => r.path !== null).map((r) => [r.path as string, r]));
}

async function hasSearchConsoleData(): Promise<boolean> {
  // Import perezoso: `gsc-sync` arrastra el cliente de Google, y esta pantalla
  // debe poder renderizar aunque ese módulo no esté configurado.
  const { hasGscData } = await import("./gsc-sync");
  return hasGscData().catch(() => false);
}

function toNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Tabla de contenidos con sus métricas de los últimos `WINDOW_DAYS` días
 * comparadas con los `WINDOW_DAYS` anteriores.
 *
 * El catálogo sale de los registros de contenido (blog publicado + landings de
 * keyword), no de los eventos: así una pieza nueva sin una sola visita aparece
 * con ceros en vez de desaparecer de la lista, que es justo la información que
 * importa.
 */
export async function getContentOverview(now: Date = new Date()): Promise<ContentOverview> {
  const windows = buildComparisonWindows(now, WINDOW_DAYS);

  const [posts, events, leadRows, searchConsoleConnected] = await Promise.all([
    getPublishedPosts().catch(() => []),
    eventTotals(windows).catch(() => new Map()),
    leadTotals(windows).catch(() => new Map()),
    hasSearchConsoleData(),
  ]);

  const catalog: Array<{ path: string; title: string; kind: "blog" | "landing"; role: ContentRole }> = [
    ...posts.map((post) => ({
      path: `/blog/${post.slug}`,
      title: post.title,
      kind: "blog" as const,
      role: contentRole(post),
    })),
    ...KEYWORD_LANDINGS.map((landing) => ({
      path: `/${landing.slug}`,
      title: landing.h1,
      kind: "landing" as const,
      role: landingRole(landing),
    })),
  ];

  const rows: ContentRow[] = catalog.map((item) => {
    const e = events.get(item.path);
    const l = leadRows.get(item.path);

    const current: ContentMetrics = {
      views: toNumber(e?.viewsCurrent),
      reads: toNumber(e?.readsCurrent),
      ctaClicks: toNumber(e?.ctaCurrent),
      leads: toNumber(l?.leadsCurrent),
      qualified: toNumber(l?.qualifiedCurrent),
    };
    const previous: ContentMetrics = {
      views: toNumber(e?.viewsPrevious),
      reads: toNumber(e?.readsPrevious),
      ctaClicks: toNumber(e?.ctaPrevious),
      leads: toNumber(l?.leadsPrevious),
      qualified: toNumber(l?.qualifiedPrevious),
    };

    return {
      ...item,
      current,
      previous,
      deltas: {
        views: delta(current.views, previous.views),
        reads: delta(current.reads, previous.reads),
        ctaClicks: delta(current.ctaClicks, previous.ctaClicks),
        leads: delta(current.leads, previous.leads),
        qualified: delta(current.qualified, previous.qualified),
      },
    };
  });

  // Orden: lo que más tráfico tiene primero; a igualdad, alfabético por título
  // para que la lista no baile entre recargas cuando todo está a cero.
  rows.sort((a, b) => b.current.views - a.current.views || a.title.localeCompare(b.title, "es"));

  const sum = (pick: (m: ContentMetrics) => number, key: "current" | "previous") =>
    rows.reduce((total, row) => total + pick(row[key]), 0);

  const totals = {
    current: {
      views: sum((m) => m.views, "current"),
      reads: sum((m) => m.reads, "current"),
      ctaClicks: sum((m) => m.ctaClicks, "current"),
      leads: sum((m) => m.leads, "current"),
      qualified: sum((m) => m.qualified, "current"),
    },
    previous: {
      views: sum((m) => m.views, "previous"),
      reads: sum((m) => m.reads, "previous"),
      ctaClicks: sum((m) => m.ctaClicks, "previous"),
      leads: sum((m) => m.leads, "previous"),
      qualified: sum((m) => m.qualified, "previous"),
    },
  };

  return { windows, rows, totals, searchConsoleConnected };
}

export const EMPTY_METRICS = ZERO;
export const SITE = SITE_ID;
