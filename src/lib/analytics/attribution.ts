/**
 * Atribución de contenido (WO-2026-00214) — funciones puras.
 *
 * Sin lado servidor y sin DOM: las usa tanto el componente de captura del
 * navegador como las server actions que persisten el lead. Quien tiene acceso
 * al documento o a `cookies()` es el llamador; aquí sólo se transforman datos.
 *
 * Qué NUNCA entra en la cookie:
 *   · IP,
 *   · el query string completo (sólo `utm_source`/`utm_medium`/`utm_campaign`),
 *   · la ruta del referrer externo (sólo su host),
 *   · nada del contenido de formularios.
 *
 * Diseño: docs/superpowers/specs/2026-09-03-seo-contenido-design.md
 */

export const ATTRIBUTION_COOKIE = 'pt_attr';

/** 90 días. Suficiente para un ciclo de venta B2B sin volverse un rastro perpetuo. */
export const ATTRIBUTION_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

export interface TouchPoint {
  /** Ruta del sitio, sin query string ni fragmento. */
  path: string;
  /** Sólo el HOST del referrer externo. Vacío si fue directo o interno. */
  ref_host: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  /** ISO 8601. */
  ts: string;
}

export interface Attribution {
  /** INMUTABLE una vez escrito. Ver `mergeLastTouch`. */
  first: TouchPoint;
  last: TouchPoint;
  /** Primer `/blog/*` o landing visto en toda la historia de la cookie. */
  first_content_path?: string;
}

const MAX_FIELD = 120;

/** Recorta y sanea un valor de texto libre que va a persistirse. */
function clean(value: string | null | undefined): string {
  return (value ?? '').trim().slice(0, MAX_FIELD);
}

function cleanPath(raw: string): string {
  const withoutQuery = clean(raw).split('?')[0].split('#')[0];
  return withoutQuery.startsWith('/') ? withoutQuery : '';
}

/**
 * Host del referrer, o `''` si es interno, vacío o no parseable.
 *
 * Sólo el host y nunca la URL completa: la ruta de un referrer externo puede
 * llevar datos de esa otra página (un buscador interno, un identificador de
 * usuario ajeno) que no nos corresponde guardar.
 */
export function referrerHost(referrer: string, currentHost?: string): string {
  const raw = clean(referrer);
  if (raw === '') return '';
  try {
    const host = new URL(raw).hostname.toLowerCase();
    if (currentHost && host === currentHost.toLowerCase()) return '';
    return host;
  } catch {
    return '';
  }
}

/**
 * Construye un punto de contacto a partir de la URL actual y el referrer.
 * `now` se inyecta para que la función sea testeable sin congelar el reloj.
 */
export function buildFirstTouch(url: string, referrer: string, now: Date = new Date()): TouchPoint | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const path = cleanPath(parsed.pathname);
  if (path === '') return null;

  return {
    path,
    ref_host: referrerHost(referrer, parsed.hostname),
    // Sólo estos tres parámetros. Guardar el query string entero es la vía por
    // la que un `?email=` o un `?token=` ajeno acabaría persistido.
    utm_source: clean(parsed.searchParams.get('utm_source')),
    utm_medium: clean(parsed.searchParams.get('utm_medium')),
    utm_campaign: clean(parsed.searchParams.get('utm_campaign')),
    ts: now.toISOString(),
  };
}

function isTouchPoint(value: unknown): value is TouchPoint {
  if (typeof value !== 'object' || value === null) return false;
  const t = value as Record<string, unknown>;
  return typeof t.path === 'string' && typeof t.ts === 'string';
}

function normalizeTouch(value: TouchPoint): TouchPoint {
  return {
    path: cleanPath(value.path),
    ref_host: clean(value.ref_host),
    utm_source: clean(value.utm_source),
    utm_medium: clean(value.utm_medium),
    utm_campaign: clean(value.utm_campaign),
    ts: clean(value.ts),
  };
}

/**
 * Lee la cookie. Devuelve `null` ante cualquier problema — cookie ausente,
 * JSON roto, forma inesperada. NUNCA lanza: una cookie corrupta no puede
 * costar un lead.
 */
export function parseAttributionCookie(raw: string | null | undefined): Attribution | null {
  if (!raw) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }

  let data: unknown;
  try {
    data = JSON.parse(decoded);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;

  const obj = data as Record<string, unknown>;
  if (!isTouchPoint(obj.first)) return null;

  const first = normalizeTouch(obj.first);
  if (first.path === '') return null;

  const last = isTouchPoint(obj.last) ? normalizeTouch(obj.last) : first;
  const firstContent = typeof obj.first_content_path === 'string' ? cleanPath(obj.first_content_path) : '';

  return {
    first,
    last: last.path === '' ? first : last,
    ...(firstContent !== '' ? { first_content_path: firstContent } : {}),
  };
}

export function serializeAttribution(attribution: Attribution): string {
  return JSON.stringify(attribution);
}

/**
 * Aplica un contacto nuevo sobre la atribución existente.
 *
 * **El first-touch es inmutable.** Si se reescribiera en cada visita, "primer
 * contacto" acabaría significando "última visita" y toda la atribución sería
 * una mentira estadística: cada lead parecería venir de la página desde la que
 * pulsó enviar.
 *
 * `first_content_path` se fija también una sola vez: es la primera pieza de
 * contenido que esa persona vio, no la última.
 */
export function mergeLastTouch(
  existing: Attribution | null,
  touch: TouchPoint,
  isContent: boolean
): Attribution {
  if (!existing) {
    return {
      first: touch,
      last: touch,
      ...(isContent ? { first_content_path: touch.path } : {}),
    };
  }

  return {
    first: existing.first,
    last: touch,
    ...(existing.first_content_path
      ? { first_content_path: existing.first_content_path }
      : isContent
        ? { first_content_path: touch.path }
        : {}),
  };
}

/** Campos de `leads` que se derivan de la atribución, listos para el insert. */
export interface LeadAttributionFields {
  attribution: Attribution | Record<string, never>;
  landingPath: string | null;
  firstContentPath: string | null;
}

/**
 * Traduce la cookie a las columnas del lead. `landing_path` es la primera
 * página del sitio en la historia de la cookie — el first-touch.
 */
export function toLeadFields(attribution: Attribution | null): LeadAttributionFields {
  if (!attribution) {
    return { attribution: {}, landingPath: null, firstContentPath: null };
  }
  return {
    attribution,
    landingPath: attribution.first.path || null,
    firstContentPath: attribution.first_content_path ?? null,
  };
}
