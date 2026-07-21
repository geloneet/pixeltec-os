/**
 * `directionTokensToCssVars` — decisión F6A #5: convierte los `designTokens`
 * de la dirección creativa elegida en un mapa de CSS custom properties
 * `--pf-*` que `PageRenderer` aplica como `style` en el wrapper raíz. Es la
 * ÚNICA traducción tokens→CSS: los blocks nunca leen `designTokens` crudos ni
 * la paleta admin del portal — SOLO consumen estas vars `--pf-*`.
 *
 * Función pura y sin DOM (testeable en entorno `node`). Produce tres capas:
 *
 *  1. Passthrough por token de paleta: cada `{token,valor}` se emite tal cual
 *     bajo su slug — `color-primario` → `--pf-color-primario: <valor>`. Deja
 *     accesible la paleta exacta que eligió la IA (debug / usos avanzados).
 *  2. Roles semánticos estables (`--pf-bg/-fg/-primary/-accent/-muted/
 *     -on-primary`): los nombres de paleta que produce la IA NO son fiables
 *     (varían por dirección), así que derivamos un set FIJO de roles con una
 *     heurística por palabra clave sobre `token`+`uso`, con fallback neutro.
 *     Los blocks consumen estos roles, nunca los slugs volátiles.
 *  3. Tipografía/forma: `--pf-font-display`, `--pf-font-body` (con stack de
 *     fallback), `--pf-radius`, `--pf-space` (unidad base de ritmo), `--pf-shadow`.
 *
 * Se asume paleta CLARA por defecto (fondo claro, texto oscuro): los fallbacks
 * y `--pf-on-primary` (texto sobre superficies de marca) se calibran a eso.
 */
import type { Direccion } from "@/lib/pixelforge/schemas/generate-directions";

/** Alias público — los designTokens de una dirección creativa (schema F5). */
export type DesignTokens = Direccion["designTokens"];

/**
 * Exportado de forma ADITIVA (PF-F8 T2, QA): `checks/design.ts` construye
 * fixtures/firmas de función sobre este tipo para reusar `findRoleValue` sin
 * duplicar la forma de una entrada de paleta.
 */
export type PaletaToken = DesignTokens["paleta"][number];

/** Quita diacríticos y baja a minúsculas — base común de slug y matching. */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Caracteres que permitirían romper fuera de la declaración de una
 * custom-property CSS (`--pf-x: <valor>;`) o inyectar contenido hostil:
 * `;` cierra la declaración, `{`/`}` abre/cierra un bloque de regla, `"`/`'`
 * rompe el `style="..."` (o el stack de fuentes `'${family}'`), `\`
 * permite escapes CSS, `url(` puede exfiltrar vía red (tracking pixel /
 * `expression()` histórico de IE), y los caracteres de control no tienen
 * ningún uso legítimo en un valor de token de diseño.
 */
const HOSTILE_CSS_VALUE_RE = /[;{}"'\\]|url\(|[\x00-\x1f\x7f]/i;

/**
 * `paleta[].valor` y `tipografia.display/body` son texto libre que produce
 * la IA y se serializa server-side en un atributo `style="..."` literal
 * (`PageRenderer`) — nunca hay que confiar en que sea CSS inerte. Rechaza
 * cualquier valor que contenga los caracteres de `HOSTILE_CSS_VALUE_RE`
 * (ver comentario ahí) devolviendo `null` en vez de intentar "limpiar" el
 * valor a medias — el llamador cae al fallback neutro de ese slot, nunca
 * emite la parte hostil.
 */
/**
 * Exportada de forma ADITIVA (PF-F8 T2, QA): `checks/design.ts` la reusa para
 * detectar (QA-DI-003) qué tokens de paleta la IA propuso que terminaron
 * descartados por hostiles — sin reimplementar la regla de sanitización.
 */
export function sanitizeCssValue(value: string): string | null {
  return HOSTILE_CSS_VALUE_RE.test(value) ? null : value;
}

/**
 * Igual que `HOSTILE_CSS_VALUE_RE` pero global — para STRIPPEAR (no
 * rechazar) los mismos caracteres hostiles de un nombre de familia
 * tipográfica antes de embeberlo en `'${family}'` dentro del stack. Una
 * familia no tiene un "valor neutro" razonable al que caer (a diferencia de
 * los roles de color, que sí tienen fallback fijo), así que aquí se limpia
 * el nombre en vez de descartarlo entero.
 */
const HOSTILE_CSS_VALUE_STRIP_RE = /[;{}"'\\\x00-\x1f\x7f]|url\(/gi;

/**
 * Fallback neutro cuando, tras strippear caracteres hostiles, no queda nombre
 * de familia utilizable. Exportado de forma ADITIVA (PF-F8 T2, QA): QA-DI-005
 * compara contra este valor para detectar cuándo `--pf-font-display`/
 * `--pf-font-body` degradaron a la familia genérica.
 */
export const NEUTRAL_FONT_FAMILY = "sans-serif";

function sanitizeFontFamilyName(family: string): string {
  const stripped = family.replace(HOSTILE_CSS_VALUE_STRIP_RE, "").trim();
  return stripped.length > 0 ? stripped : NEUTRAL_FONT_FAMILY;
}

/**
 * Último recurso de `pickRole` cuando keywords, `uso` y `fallback` son todos
 * hostiles/ausentes. Exportado de forma ADITIVA (PF-F8 T2, QA): QA-DI-001 lo
 * usa para reconocer la caída al neutro final por paleta monocolor.
 */
export const NEUTRAL_ROLE_FALLBACK = "#0f172a";

/**
 * `Color Primario!` → `color-primario` (para el nombre de la CSS var).
 * Exportada de forma ADITIVA (PF-F8 T2, QA): QA-DI-003 la reusa para nombrar
 * el token descartado sin reimplementar el slug.
 */
export function slugify(value: string): string {
  return normalize(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Valor de paleta para un rol semántico. Prioriza el NOMBRE del token (más
 * fiable) sobre el `uso` (prosa libre que suele mencionar otros roles — p.ej.
 * "fondos oscuros y texto principal" menciona "fondo" en el token primario):
 * primero busca la keyword en el slug del token; sólo si nadie matchea por
 * nombre cae a buscar en el `uso`; y si aún nada, `fallback`. Así el rol
 * siempre tiene valor sin depender de que la IA nombre los tokens "bien".
 *
 * Cada `entry.valor` es texto libre de la IA — un candidato solo cuenta como
 * match si además pasa `sanitizeCssValue` (si no, se trata como si no
 * matcheara y se sigue buscando). `fallback` también se sanitiza antes de
 * devolverse: si el propio fallback viene hostil (p.ej. `paleta[0].valor`
 * como fallback de `primary`), cae al neutro final.
 *
 * Exportada de forma ADITIVA (PF-F8 T2, QA): QA-DI-004 la reusa para saber si
 * un rol matcheó semánticamente contra la paleta (vs. cayó al `fallback` de
 * `pickRole`) sin duplicar la heurística de keywords.
 */
export function findRoleValue(paleta: readonly PaletaToken[], keywords: readonly string[]): string | null {
  const matches = (text: string) => keywords.some((keyword) => normalize(text).includes(keyword));
  const safeValor = (entry: PaletaToken) => sanitizeCssValue(entry.valor);
  const byName = paleta.find((entry) => matches(entry.token) && safeValor(entry) !== null);
  if (byName) return safeValor(byName) as string;
  const byUso = paleta.find((entry) => matches(entry.uso) && safeValor(entry) !== null);
  if (byUso) return safeValor(byUso) as string;
  return null;
}

function pickRole(paleta: readonly PaletaToken[], keywords: readonly string[], fallback: string): string {
  return findRoleValue(paleta, keywords) ?? sanitizeCssValue(fallback) ?? NEUTRAL_ROLE_FALLBACK;
}

/**
 * Frases que describen el fondo GENERAL de la página (gate F6A, hallazgo B1):
 * las paletas IA suelen traer VARIOS usos con "fondo" ("fondo de arranque de
 * la sección X" vs "fondo general de la página") y el primer match por orden
 * de paleta elegía el fondo de UNA sección como fondo de TODA la landing.
 * Estas frases se buscan primero; sólo si ninguna aparece se cae a las
 * keywords genéricas de fondo. (Se matchea sobre texto normalizado sin
 * acentos: "página" → "pagina".)
 */
const BG_GENERAL_KEYWORDS = [
  "fondo general",
  "fondo de pagina",
  "fondo de la pagina",
  "fondo principal",
  "background principal",
  "background general",
] as const;

const RADIUS_MAP: Record<DesignTokens["radios"], string> = {
  rectos: "0px",
  suaves: "0.5rem",
  redondeados: "1rem",
};

const SPACE_MAP: Record<DesignTokens["espaciado"], string> = {
  compacto: "0.75rem",
  equilibrado: "1rem",
  aireado: "1.5rem",
};

const SHADOW_MAP: Record<NonNullable<DesignTokens["sombra"]>, string> = {
  ninguna: "none",
  sutil: "0 1px 3px rgba(0,0,0,0.08), 0 6px 16px rgba(0,0,0,0.06)",
  pronunciada: "0 4px 8px rgba(0,0,0,0.10), 0 18px 40px rgba(0,0,0,0.14)",
};

/**
 * Stack tipográfico: la familia elegida + fallbacks genéricos del sistema.
 * `family` es texto libre de la IA embebido entre comillas simples — se
 * strippean los mismos caracteres hostiles que `sanitizeCssValue` rechaza
 * (una comilla suelta rompería el `'${family}'` y todo lo que sigue).
 */
function fontStack(family: string): string {
  return `'${sanitizeFontFamilyName(family)}', ui-sans-serif, system-ui, sans-serif`;
}

/**
 * Keywords/fallbacks por rol semántico y valor de `--pf-on-primary` —
 * extraídos a constantes nombradas y exportados de forma ADITIVA (PF-F8 T2,
 * QA): `checks/design.ts` (QA-DI-004) los reusa junto con `findRoleValue`
 * para saber si un rol matcheó semánticamente la paleta de la IA o cayó al
 * fallback, sin duplicar (y arriesgar divergencia de) estas listas.
 */
export const BG_GENERIC_KEYWORDS = [
  "fondo",
  "background",
  "base",
  "superficie",
  "surface",
  "papel",
  "lienzo",
  "claro",
  "light",
] as const;
export const BG_DEFAULT_FALLBACK = "#ffffff";

export const PRIMARY_KEYWORDS = ["primari", "primary", "marca", "brand", "principal"] as const;

export const ACCENT_KEYWORDS = ["acent", "accent", "secundari", "secondary", "highlight", "destac", "cta"] as const;

export const FG_KEYWORDS = ["texto", "text", "tinta", "ink", "cuerpo", "body", "oscuro", "dark", "contenido"] as const;
export const FG_DEFAULT_FALLBACK = "#0f172a";

export const MUTED_KEYWORDS = [
  "muted",
  "apagado",
  "suave",
  "tenue",
  "gris",
  "gray",
  "grey",
  "borde",
  "border",
  "neutral",
  "sutil",
] as const;
export const MUTED_DEFAULT_FALLBACK = "#64748b";

export const ON_PRIMARY_VALUE = "#ffffff";

export function directionTokensToCssVars(tokens: DesignTokens): Record<string, string> {
  const vars: Record<string, string> = {};

  // 1. Passthrough slugueado de cada token de paleta. Un `valor` hostil
  //    (rechazado por `sanitizeCssValue`) simplemente NO se emite — no hay
  //    un fallback semántico razonable para un slug arbitrario, y omitir la
  //    var es estrictamente más seguro que inventar un valor.
  for (const entry of tokens.paleta) {
    const slug = slugify(entry.token);
    if (!slug) continue;
    const safeValor = sanitizeCssValue(entry.valor);
    if (safeValor !== null) vars[`--pf-${slug}`] = safeValor;
  }

  // 2. Roles semánticos estables (lo que consumen los blocks). `bg` se
  //    resuelve PRIMERO (con prioridad para el fondo general de la página)
  //    porque el guard de colisión de `primary` depende de él.
  vars["--pf-bg"] =
    findRoleValue(tokens.paleta, BG_GENERAL_KEYWORDS) ?? pickRole(tokens.paleta, BG_GENERIC_KEYWORDS, BG_DEFAULT_FALLBACK);

  let primary = pickRole(tokens.paleta, PRIMARY_KEYWORDS, tokens.paleta[0].valor);
  // Guard B1: primary NUNCA puede quedar igual que bg (texto invisible —
  // stats-band, headings). Si colisionan (comparación case-insensitive, son
  // valores hex/texto de IA), se toma el siguiente candidato válido de la
  // paleta en orden; si la paleta entera es monocolor, el neutro final.
  if (primary.toLowerCase() === vars["--pf-bg"].toLowerCase()) {
    const next = tokens.paleta
      .map((entry) => sanitizeCssValue(entry.valor))
      .find((valor): valor is string => valor !== null && valor.toLowerCase() !== vars["--pf-bg"].toLowerCase());
    primary = next ?? NEUTRAL_ROLE_FALLBACK;
  }
  // `accent` usa `primary` como fallback: ya viene sanitizado (arriba), así
  // que no puede reintroducir un valor hostil.
  const accent = pickRole(tokens.paleta, ACCENT_KEYWORDS, primary);
  vars["--pf-primary"] = primary;
  vars["--pf-accent"] = accent;
  vars["--pf-fg"] = pickRole(tokens.paleta, FG_KEYWORDS, FG_DEFAULT_FALLBACK);
  vars["--pf-muted"] = pickRole(tokens.paleta, MUTED_KEYWORDS, MUTED_DEFAULT_FALLBACK);
  vars["--pf-on-primary"] = ON_PRIMARY_VALUE;

  // 3. Tipografía y forma.
  vars["--pf-font-display"] = fontStack(tokens.tipografia.display);
  vars["--pf-font-body"] = fontStack(tokens.tipografia.body);
  vars["--pf-radius"] = RADIUS_MAP[tokens.radios];
  vars["--pf-space"] = SPACE_MAP[tokens.espaciado];
  vars["--pf-shadow"] = SHADOW_MAP[tokens.sombra ?? "sutil"];

  return vars;
}
