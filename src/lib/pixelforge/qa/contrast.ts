/**
 * Ratio de contraste WCAG 2.1 (luminancia relativa) sobre colores CSS que se
 * pueden parsear server-side, sin DOM. Módulo puro, sin dependencias — lo usa
 * `checks/design.ts` (QA-DI-002) para evaluar los pares de rol semántico
 * (`--pf-fg`/`--pf-bg`, etc.) que produce `directionTokensToCssVars`.
 *
 * Formatos soportados: hex de 3/6/8 dígitos (`#abc`, `#aabbcc`, `#aabbccdd` —
 * el canal alfa de hex8 se ignora para el cálculo de contraste, igual que el
 * alfa de `rgba()`/`hsla()`: la fórmula WCAG opera sobre color OPACO, y estas
 * vars siempre se renderizan sobre un fondo sólido, nunca compuestas), y las
 * funciones `rgb()`/`rgba()`/`hsl()`/`hsla()`. Cualquier otro formato (named
 * colors como `"red"`, `currentColor`, gradientes, etc.) devuelve `null` — el
 * caller decide qué hacer con un color no evaluable (QA-DI-002 emite un
 * finding `info` "no evaluable server-side" en ese caso).
 */

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

function clampChannel(value: number): number {
  return Math.min(255, Math.max(0, value));
}

const HEX3_RE = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i;
const HEX6_RE = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;
const HEX8_RE = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

function hexToRgb(value: string): RgbColor | null {
  const m3 = HEX3_RE.exec(value);
  if (m3) {
    return {
      r: parseInt(m3[1] + m3[1], 16),
      g: parseInt(m3[2] + m3[2], 16),
      b: parseInt(m3[3] + m3[3], 16),
    };
  }

  // hex8 se prueba ANTES que hex6: ambas regex son ancladas (^...$) así que
  // en realidad no colisionan, pero probar la más específica (8 dígitos)
  // primero evita depender del orden de los grupos si la regex de hex6
  // cambiara a no anclada en el futuro.
  const m8 = HEX8_RE.exec(value);
  if (m8) {
    return { r: parseInt(m8[1], 16), g: parseInt(m8[2], 16), b: parseInt(m8[3], 16) };
  }

  const m6 = HEX6_RE.exec(value);
  if (m6) {
    return { r: parseInt(m6[1], 16), g: parseInt(m6[2], 16), b: parseInt(m6[3], 16) };
  }

  return null;
}

const RGB_FUNCTION_RE = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*[\d.]+\s*)?\)$/i;

function rgbFunctionToRgb(value: string): RgbColor | null {
  const m = RGB_FUNCTION_RE.exec(value);
  if (!m) return null;
  const r = Number(m[1]);
  const g = Number(m[2]);
  const b = Number(m[3]);
  if (![r, g, b].every(Number.isFinite)) return null;
  return { r: clampChannel(r), g: clampChannel(g), b: clampChannel(b) };
}

const HSL_FUNCTION_RE = /^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*(?:,\s*[\d.]+\s*)?\)$/i;

/** Conversión estándar HSL → RGB (h en grados 0-360, s/l en 0-100). */
function hslToRgb(h: number, s: number, l: number): RgbColor {
  const hue = ((h % 360) + 360) % 360;
  const sat = Math.min(1, Math.max(0, s / 100));
  const light = Math.min(1, Math.max(0, l / 100));

  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = light - c / 2;

  let [r1, g1, b1] = [0, 0, 0];
  if (hue < 60) [r1, g1, b1] = [c, x, 0];
  else if (hue < 120) [r1, g1, b1] = [x, c, 0];
  else if (hue < 180) [r1, g1, b1] = [0, c, x];
  else if (hue < 240) [r1, g1, b1] = [0, x, c];
  else if (hue < 300) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];

  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

function hslFunctionToRgb(value: string): RgbColor | null {
  const m = HSL_FUNCTION_RE.exec(value);
  if (!m) return null;
  const h = Number(m[1]);
  const s = Number(m[2]);
  const l = Number(m[3]);
  if (![h, s, l].every(Number.isFinite)) return null;
  return hslToRgb(h, s, l);
}

/** Parsea un color CSS a `{r,g,b}` (0-255 cada canal) o `null` si el formato no es soportado. */
export function parseCssColor(value: string): RgbColor | null {
  const trimmed = value.trim();
  return hexToRgb(trimmed) ?? rgbFunctionToRgb(trimmed) ?? hslFunctionToRgb(trimmed) ?? null;
}

function srgbChannelToLinear(channel255: number): number {
  const c = channel255 / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Luminancia relativa WCAG 2.1 (fórmula fija: 0.2126R + 0.7152G + 0.0722B, canales en sRGB linealizado). */
export function relativeLuminance(color: RgbColor): number {
  return (
    0.2126 * srgbChannelToLinear(color.r) +
    0.7152 * srgbChannelToLinear(color.g) +
    0.0722 * srgbChannelToLinear(color.b)
  );
}

/**
 * Ratio de contraste WCAG 2.1 entre dos colores CSS: `(L1+0.05)/(L2+0.05)`
 * con `L1` la luminancia MAYOR de las dos (orden de argumentos irrelevante).
 * `null` si cualquiera de los dos valores no es un color parseable por
 * `parseCssColor` — nunca lanza.
 */
export function contrastRatio(colorA: string, colorB: string): number | null {
  const a = parseCssColor(colorA);
  const b = parseCssColor(colorB);
  if (!a || !b) return null;

  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);

  return (lighter + 0.05) / (darker + 0.05);
}
