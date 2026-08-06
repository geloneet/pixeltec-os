/**
 * Lógica PURA de las Herramientas de IA del editor (B-PR6) — compartida entre
 * la Server Action (`actions/ai-tools.ts`) y el cliente (menú del editor),
 * para que ambos calculen EXACTAMENTE el mismo objetivo de reescritura.
 *
 * Vive fuera del módulo 'use server' porque esos módulos solo pueden exportar
 * funciones async.
 */

/** Los 4 tonos del brief (nuevo-brief-form.tsx) — unión cerrada. */
export const BLOG_TONES = [
  'técnico-directo',
  'educativo',
  'opinión-defendida',
  'caso-práctico',
] as const;

export type BlogTone = (typeof BLOG_TONES)[number];

export function isBlogTone(value: string): value is BlogTone {
  return (BLOG_TONES as readonly string[]).includes(value);
}

/** Tope duro del objetivo de «Corregir tono»: el presupuesto de la respuesta
 *  es max_tokens ≤ 1024 (plan B-PR6) — reescribir el cuerpo completo no cabe
 *  sin truncarlo, y aplicar una propuesta truncada destruiría contenido. */
export const TONE_TARGET_MAX_CHARS = 3200;

export interface ToneTarget {
  /** Fragmento del cuerpo que se reescribe (siempre desde el inicio). */
  target: string;
  /** Índice EXCLUSIVO donde termina el objetivo dentro del body original —
   *  aplicar = `proposal + body.slice(end)`. */
  end: number;
}

/**
 * «Corregir tono» opera sobre la INTRODUCCIÓN del artículo (desde el inicio
 * hasta el primer H2), que es donde el tono queda fijado, y así la propuesta
 * cabe completa en el presupuesto de tokens. Si no hay H2, cae al cuerpo
 * completo cuando es corto, o al mayor bloque de párrafos que quepa en
 * TONE_TARGET_MAX_CHARS (cortando SIEMPRE en un límite de párrafo `\n\n`,
 * nunca a media frase).
 */
export function extractToneTarget(body: string): ToneTarget {
  const normalized = body ?? '';
  const h2Idx = normalized.indexOf('\n## ');
  if (h2Idx !== -1 && h2Idx <= TONE_TARGET_MAX_CHARS) {
    return { target: normalized.slice(0, h2Idx), end: h2Idx };
  }
  if (normalized.length <= TONE_TARGET_MAX_CHARS) {
    return { target: normalized, end: normalized.length };
  }
  const cut = normalized.lastIndexOf('\n\n', TONE_TARGET_MAX_CHARS);
  const end = cut > 0 ? cut : TONE_TARGET_MAX_CHARS;
  return { target: normalized.slice(0, end), end };
}
