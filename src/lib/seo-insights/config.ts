/**
 * Configuración única del módulo SEO & Contenido (WO-2026-00214, Fase 1).
 *
 * Todo lo que otro archivo del módulo necesite parametrizar vive aquí: los
 * pisos, la ventana, el regex de marca y qué paths cuentan como "contenido".
 * Repartir estos valores por los consumidores es cómo un módulo acaba con tres
 * definiciones distintas de "los últimos 28 días".
 *
 * Diseño: docs/superpowers/specs/2026-09-03-seo-contenido-design.md
 */

import { KEYWORD_LANDINGS } from "@/lib/content/keyword-landings";
import { DESARROLLO_WEB_CITIES, CONSULTORIA_CITIES } from "@/lib/content/local-services";
import { LOCAL_AUTOMATION_CITIES } from "@/lib/content/automatizacion-local";

/**
 * El módulo administra UN solo sitio, igual que el módulo SEO existente
 * (`app_settings`, migración 0044, decisión de Miguel 2026-08-26). Un futuro
 * multi-sitio cabe por `site_id` sin otra migración: la columna ya existe.
 */
export const SITE_ID = "pixeltec.mx";

/**
 * Propiedad de Search Console. Formato de dominio (`sc-domain:pixeltec.mx`),
 * no de prefijo de URL: la propiedad de dominio cubre http/https, www y
 * subdominios en una sola, que es lo que está verificado.
 *
 * Sin variable no hay valor por defecto **a propósito**: apuntar a una
 * propiedad adivinada sería peor que fallar. El cliente de GSC lanza
 * `gsc_not_configured` cuando falta.
 */
export const GSC_PROPERTY = process.env.GSC_SITE_URL ?? "";

/**
 * Consultas de marca. Se separan porque mezclarlas con las genéricas infla el
 * CTR y hunde la posición media de todo lo demás: quien busca "pixeltec" ya
 * nos conoce y hace clic casi siempre, así que su comportamiento no dice nada
 * sobre si el contenido capta demanda nueva.
 *
 * Cubre las variantes reales de tecleo: "pixeltec", "pixel tec", "pixel tek",
 * "pixeltek". El flag `i` va como flag de JS — el `(?i)` en línea del plan
 * original es sintaxis de PCRE/Python y en JavaScript se interpretaría como un
 * grupo literal, es decir, el regex nunca casaría.
 */
export const BRAND_QUERY_REGEX = /pixel\s?te[ck]/i;

/**
 * Prefijos y rutas exactas que cuentan como CONTENIDO del sitio (lo que este
 * módulo mide). Se derivan de los registros reales — no hay una lista escrita
 * a mano que se desincronice cuando se publique una landing nueva.
 *
 * - `/blog/` es un prefijo: cada artículo es un path distinto.
 * - Las landings son rutas exactas de primer nivel (`/<slug>`), generadas por
 *   `scripts/gen-keyword-landing-pages.mjs` desde estos mismos registros.
 */
export const CONTENT_PATH_PREFIXES: readonly string[] = ["/blog/"];

/** Rutas exactas de landing, derivadas de los tres registros de contenido. */
export const CONTENT_LANDING_PATHS: readonly string[] = [
  ...KEYWORD_LANDINGS.map((l) => `/${l.slug}`),
  ...DESARROLLO_WEB_CITIES.map((c) => `/${c.slug}`),
  ...CONSULTORIA_CITIES.map((c) => `/${c.slug}`),
  ...LOCAL_AUTOMATION_CITIES.map((c) => `/${c.slug}`),
];

/** Matchers completos — el orden no importa, `isContentPath` prueba ambos. */
export const CONTENT_PATH_MATCHERS: readonly string[] = [
  ...CONTENT_PATH_PREFIXES,
  ...CONTENT_LANDING_PATHS,
];

const LANDING_PATH_SET = new Set(CONTENT_LANDING_PATHS);

/**
 * ¿Este path es una pieza de contenido medible? Compara sin query string y sin
 * barra final: `/blog/x?utm=y` y `/blog/x/` son el mismo contenido.
 */
export function isContentPath(rawPath: string): boolean {
  const path = normalizeContentPath(rawPath);
  if (path === "") return false;
  if (LANDING_PATH_SET.has(path)) return true;
  return CONTENT_PATH_PREFIXES.some((prefix) => path.startsWith(prefix) && path.length > prefix.length);
}

/**
 * Forma canónica de un path para guardarlo y compararlo: sin origen, sin query
 * string, sin fragmento y sin barra final.
 *
 * El descarte del query string NO es cosmético — es la frontera de privacidad:
 * es por donde un `?email=` o un `?token=` de un tercero acabaría persistido en
 * `content_events`.
 */
export function normalizeContentPath(rawPath: string): string {
  const withoutOrigin = rawPath.replace(/^https?:\/\/[^/]+/i, "");
  const withoutQuery = withoutOrigin.split("?")[0].split("#")[0];
  if (withoutQuery === "" || !withoutQuery.startsWith("/")) return "";
  const trimmed = withoutQuery.length > 1 ? withoutQuery.replace(/\/+$/, "") : withoutQuery;
  return trimmed === "" ? "/" : trimmed;
}

/** Slug del artículo si el path es `/blog/<slug>`, o null. */
export function blogSlugFromPath(rawPath: string): string | null {
  const path = normalizeContentPath(rawPath);
  const match = /^\/blog\/([^/]+)$/.exec(path);
  return match ? match[1] : null;
}

// ── Ventanas y pisos ────────────────────────────────────────────────────────

/**
 * 28 y no 30: alinea los días de la semana. Comparar cuatro semanas completas
 * contra cuatro semanas completas evita que un mes con cinco lunes parezca
 * crecimiento.
 */
export const WINDOW_DAYS = 28;

/**
 * Retraso de Search Console. La API no tiene datos completos de ayer ni de
 * anteayer, y sigue reescribiendo lo ya publicado durante unos días.
 */
export const GSC_LAG_DAYS = 3;

/** Días que el cron re-trae en cada corrida incremental (cubre el retraso con margen). */
export const GSC_REFRESH_DAYS = 5;

/** Profundidad del backfill inicial: el máximo que Search Console conserva. */
export const GSC_BACKFILL_MONTHS = 16;

/**
 * Pisos por debajo de los cuales una regla NO opina. Sin ellos, una página con
 * 3 impresiones y 0 clics dispararía "mejorar CTR" — que es ruido estadístico
 * presentado como recomendación.
 */
export interface SeoThresholds {
  /** Impresiones mínimas en la ventana para opinar sobre posición/CTR. */
  minImpressions: number;
  /** Visitas mínimas en la ventana para opinar sobre CTA/conversión. */
  minVisits: number;
  /** Posición media por debajo de la cual una página ya está "arriba". */
  topPosition: number;
  /** Posición media por encima de la cual la página está fuera de juego. */
  tailPosition: number;
}

export const DEFAULT_THRESHOLDS: SeoThresholds = {
  minImpressions: 100,
  minVisits: 30,
  topPosition: 5,
  tailPosition: 20,
};
