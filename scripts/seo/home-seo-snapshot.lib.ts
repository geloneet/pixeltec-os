/**
 * Funciones puras del snapshot SEO del home (WO-2026-00343).
 *
 * Sin dependencias, sin red: reciben HTML como string y devuelven números que
 * se pueden comparar entre dos fechas. El método es la definición de «palabras
 * visibles» y «enlace a landing» que usa todo el equipo — no se cambia sin
 * regenerar la línea base.
 */

/** Términos que se cuentan en cada snapshot (orden = orden del reporte). */
export const HOME_TERMS: readonly string[] = [
  'desarrollo web',
  'página web',
  'páginas web',
  'software a la medida',
  'software a medida',
  'automatización',
  'IA',
  'WhatsApp',
  'consultoría',
  'pymes',
  'CRM',
  'app',
  'Puerto Vallarta',
  'Bahía de Banderas',
  'Guadalajara',
  'Zapopan',
  'Jalisco',
  'México',
];

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&#x27;': "'",
  '&nbsp;': ' ',
};

function decodeEntities(input: string): string {
  return input.replace(/&(amp|lt|gt|quot|#39|#x27|nbsp);/g, (m) => ENTITIES[m] ?? m);
}

/** Texto que un lector vería: sin script/style/noscript/svg/template ni etiquetas. */
export function visibleText(html: string): string {
  const withoutBlocks = html
    .replace(/<(script|style|noscript|svg|template)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  return decodeEntities(withoutBlocks).replace(/\s+/g, ' ').trim();
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

function fold(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Ocurrencias de `term` como palabra(s) completa(s), sin distinguir mayúsculas ni acentos. */
export function countTerm(text: string, term: string): number {
  const haystack = fold(text);
  const needle = escapeRegex(fold(term)).replace(/\s+/g, '\\s+');
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${needle}(?![\\p{L}\\p{N}])`, 'gu');
  return (haystack.match(re) ?? []).length;
}

const ASSET_PREFIXES = ['/_next/', '/icon', '/favicon', '/apple-icon', '/manifest', '/images/', '/og-image'];

/** hrefs internos de contenido, en orden de aparición, sin hash ni query. */
export function internalHrefs(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/href="(\/[^"]*)"/g)) {
    const path = m[1].split('#')[0].split('?')[0];
    if (path === '') continue;
    if (ASSET_PREFIXES.some((p) => path.startsWith(p))) continue;
    if (/\.(css|js|png|jpg|jpeg|webp|svg|ico|xml|txt)$/i.test(path)) continue;
    out.push(path);
  }
  return out;
}

export function classifyLinks(
  hrefs: string[],
  landingSlugs: Set<string>,
): { total: number; unique: number; landing: number; landingHrefs: string[] } {
  const unique = [...new Set(hrefs)];
  const landingHrefs = unique.filter((h) => landingSlugs.has(h.replace(/^\//, '').split('/')[0]));
  return { total: hrefs.length, unique: unique.length, landing: landingHrefs.length, landingHrefs };
}

export function headingOutline(html: string): { level: number; text: string }[] {
  const out: { level: number; text: string }[] = [];
  for (const m of html.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)) {
    out.push({ level: Number(m[1]), text: visibleText(m[2]) });
  }
  return out;
}

/** `@type` de cada bloque JSON-LD (raíz o `@graph`), en orden; bloques rotos se ignoran. */
export function jsonLdTypes(html: string): string[] {
  const types: string[] = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(m[1]);
    } catch {
      continue;
    }
    const nodes = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object' && Array.isArray((parsed as { '@graph'?: unknown[] })['@graph'])
        ? ((parsed as { '@graph': unknown[] })['@graph'] as unknown[])
        : [parsed];
    for (const node of nodes) {
      const t = (node as { '@type'?: unknown })?.['@type'];
      if (typeof t === 'string') types.push(t);
      else if (Array.isArray(t)) types.push(...t.filter((x): x is string => typeof x === 'string'));
    }
  }
  return types;
}

/** Slugs `slug: '…'` de los registros de contenido (mismo regex que gen-keyword-landing-pages.mjs). */
export function landingSlugsFromSource(sources: string[]): Set<string> {
  const slugs = new Set<string>();
  for (const src of sources) {
    for (const m of src.matchAll(/\bslug:\s*'([a-z0-9]+(?:-[a-z0-9]+)*)'/g)) slugs.add(m[1]);
  }
  return slugs;
}
