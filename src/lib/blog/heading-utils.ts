/**
 * Utilidades compartidas de headings del blog — SIN 'use client': las usa el
 * RSC del artículo (tabla de contenidos) y el renderer cliente (ids de ancla).
 * Ambos DEBEN producir el mismo id para el mismo texto.
 */

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export interface HeadingEntry {
  depth: 2 | 3;
  text: string;
  id: string;
}

/** Extrae h2/h3 del Markdown ignorando bloques de código. */
export function extractHeadings(markdown: string): HeadingEntry[] {
  const headings: HeadingEntry[] = [];
  let inFence = false;
  for (const line of markdown.split('\n')) {
    if (/^```/.test(line.trim())) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = line.match(/^(#{2,3})\s+(.+?)\s*#*\s*$/);
    if (!m) continue;
    const text = m[2].replace(/[*_`~]/g, '').trim();
    if (!text) continue;
    headings.push({ depth: m[1].length as 2 | 3, text, id: slugifyHeading(text) });
  }
  return headings;
}
