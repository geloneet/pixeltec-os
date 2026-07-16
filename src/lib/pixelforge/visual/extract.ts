/**
 * Extracción saneada de señales visuales/semánticas desde HTML crudo.
 *
 * El HTML crudo obtenido por `safe-fetch.ts` de una URL de referencia
 * pegada por el trabajador NUNCA se retorna ni persiste — es contenido no
 * confiable de un tercero. Esta función parsea únicamente las señales
 * puntuales listadas en `ExtractedSignals` (regex propio, sin dependencias
 * de parser HTML) y descarta todo lo demás, incluyendo el contenido de
 * `<script>` y cualquier texto fuera de los campos reconocidos.
 */

export interface ExtractedSignals {
  title: string | null;
  description: string | null;
  headings: string[];
  colors: string[];
  fonts: string[];
}

const MAX_TITLE_LEN = 200;
const MAX_DESCRIPTION_LEN = 300;
const MAX_HEADINGS = 20;
const MAX_HEADING_LEN = 120;
const MAX_COLORS = 40;
const MAX_FONTS = 20;

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, "");
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'");
}

function collapseWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function cleanText(raw: string): string {
  return collapseWhitespace(decodeEntities(stripTags(raw)));
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return null;
  const cleaned = cleanText(match[1]!);
  if (!cleaned) return null;
  return cleaned.slice(0, MAX_TITLE_LEN);
}

function extractDescription(html: string): string | null {
  const metaTags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of metaTags) {
    if (!/name\s*=\s*["']description["']/i.test(tag)) continue;
    const contentMatch = tag.match(/content\s*=\s*["']([^"']*)["']/i);
    if (!contentMatch) continue;
    const cleaned = cleanText(contentMatch[1]!);
    if (!cleaned) return null;
    return cleaned.slice(0, MAX_DESCRIPTION_LEN);
  }
  return null;
}

function extractHeadings(html: string): string[] {
  const headings: string[] = [];
  const re = /<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null && headings.length < MAX_HEADINGS) {
    const cleaned = cleanText(match[2]!);
    if (cleaned) headings.push(cleaned.slice(0, MAX_HEADING_LEN));
  }
  return headings;
}

/** Junta el CSS "visible" al parser: bloques <style> + atributos style="". */
function collectCssText(html: string): string {
  const chunks: string[] = [];

  const styleBlocks = html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi);
  for (const m of styleBlocks) chunks.push(m[1] ?? "");

  const inlineStyles = html.matchAll(/\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/gi);
  for (const m of inlineStyles) chunks.push((m[1] ?? m[2] ?? "") + ";");

  return chunks.join("\n");
}

function extractColorValue(declarationValue: string): string | null {
  const hex = declarationValue.match(/#[0-9a-fA-F]{3,8}\b/);
  if (hex) return hex[0];
  const rgb = declarationValue.match(/rgba?\([^)]*\)/i);
  if (rgb) return rgb[0];
  const hsl = declarationValue.match(/hsla?\([^)]*\)/i);
  if (hsl) return hsl[0];
  return null;
}

function extractColors(cssText: string): string[] {
  const seen = new Set<string>();
  const re = /([a-zA-Z-]*(?:color|background)[a-zA-Z-]*)\s*:\s*([^;{}]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(cssText)) !== null && seen.size < MAX_COLORS) {
    const value = extractColorValue(match[2]!);
    if (value) seen.add(value);
  }
  return Array.from(seen);
}

function extractFonts(cssText: string): string[] {
  const seen = new Set<string>();
  const re = /font-family\s*:\s*([^;{}]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(cssText)) !== null) {
    const tokens = match[1]!.split(",");
    for (const token of tokens) {
      if (seen.size >= MAX_FONTS) break;
      const name = token.trim().replace(/^["']|["']$/g, "");
      if (name) seen.add(name);
    }
  }
  return Array.from(seen).slice(0, MAX_FONTS);
}

/**
 * Extrae señales visuales/semánticas saneadas de un HTML crudo. El HTML de
 * entrada nunca se retorna ni se incluye (ni entero ni en fragmentos más
 * allá de los campos reconocidos): solo se exponen título, descripción,
 * headings de texto plano, y colores/fuentes declarados en CSS.
 */
export function extractSignals(html: string, _finalUrl: string): ExtractedSignals {
  // El contenido de <script>/<noscript> nunca debe alimentar ninguna señal
  // (podría contener HTML fabricado vía document.write, JSON, etc. que
  // simule headings o metadatos). Se descarta ANTES de cualquier regex.
  const sanitized = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, "");

  const cssText = collectCssText(sanitized);

  return {
    title: extractTitle(sanitized),
    description: extractDescription(sanitized),
    headings: extractHeadings(sanitized),
    colors: extractColors(cssText),
    fonts: extractFonts(cssText),
  };
}
