/**
 * B-PR8 — Guardia de roundtrip Markdown para el editor visual (Tiptap).
 *
 * El almacenamiento canónico del blog es Markdown. El editor visual
 * (Tiptap + tiptap-markdown) deserializa Markdown → ProseMirror y vuelve a
 * serializar en cada cambio. Ese viaje NO es byte-a-byte estable: el
 * serializador emite un estilo concreto (bullets `-`, énfasis `*`, escapes…).
 *
 * Este módulo decide si un post puede abrirse en modo visual sin pérdida:
 *   - `hasRawHtml(md)`      — detecta HTML crudo (el editor visual no lo conserva).
 *   - `normalizeMarkdown(md)` — canoniza las diferencias de estilo TOLERABLES
 *     (idéntico render) para comparar original vs roundtrip.
 *   - `markdownRoundtripSafe(md, serializeFn)` — veredicto final.
 *
 * Es deliberadamente conservador: ante cualquier diferencia no cubierta por
 * una regla de equivalencia documentada, el veredicto es `safe: false` y el
 * editor abre en modo Markdown (fallback permanente, sin pérdida).
 *
 * Módulo puro: sin dependencias de Tiptap ni del DOM (usable en tests node,
 * en el cliente y en scripts de verificación de corpus).
 */

export interface RoundtripVerdict {
  safe: boolean;
  /** Presente solo cuando `safe === false`; describe el motivo (diagnóstico). */
  reason?: string;
}

// ─── Detección de HTML crudo ──────────────────────────────────────────────────

/**
 * Etiqueta HTML de apertura/cierre/autocerrada: `<div>`, `</iframe>`,
 * `<img src="…">`, `<br/>`. Exige nombre de etiqueta válido seguido de
 * espacio, `>` o `/>`, con lo que NO matchea:
 *   - autolinks `<https://…>` / `<mailto:…>` (tras el nombre viene `:`),
 *   - comparaciones `a < b` (espacio tras `<`),
 *   - `<3` (dígito tras `<`).
 */
const HTML_TAG_RE = /<\/?[a-zA-Z][a-zA-Z0-9-]*(\s[^<>]*)?\/?>/;
const HTML_COMMENT_RE = /<!--/;

/**
 * ¿Contiene el Markdown HTML crudo relevante (bloques o inline)?
 * El código (fences e inline code) se excluye antes de evaluar: `<div>` dentro
 * de un fence es contenido literal, no HTML del documento.
 */
export function hasRawHtml(md: string): boolean {
  const stripped = stripCode(md);
  return HTML_TAG_RE.test(stripped) || HTML_COMMENT_RE.test(stripped);
}

/** Elimina fences (```/~~~) e inline code, conservando el resto del texto. */
function stripCode(md: string): string {
  const outLines: string[] = [];
  let fence: string | null = null;
  for (const line of md.split("\n")) {
    const open = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (fence) {
      // Cierre: misma familia de fence, longitud >= apertura, solo el fence.
      if (open && open[1][0] === fence[0] && open[1].length >= fence.length) {
        fence = null;
      }
      continue; // línea de código: fuera
    }
    if (open) {
      fence = open[1];
      continue;
    }
    // Inline code: `…`, ``…`` (backticks emparejados)
    outLines.push(line.replace(/(`+)([^`]|[^`][\s\S]*?[^`])\1/g, " "));
  }
  return outLines.join("\n");
}

// ─── Normalización (reglas de equivalencia tolerables) ────────────────────────

/**
 * Canoniza un Markdown para comparación. Cada regla cubre una diferencia de
 * ESTILO cuyo render es idéntico; el contenido nunca se altera semánticamente.
 * Las líneas dentro de fences de código NO se tocan (contenido literal).
 *
 * Reglas (documentadas una a una):
 *  R1  Finales de línea: CRLF/CR → LF.
 *  R2  Espacios finales de línea: se eliminan. Un hard break real (≥2
 *      espacios al final Y una línea siguiente con contenido) se canoniza al
 *      hard break con backslash (`\`), que es la forma que emite el
 *      serializador — mismo render (<br>). Espacios finales en la última
 *      línea de un bloque no son hard break y simplemente se eliminan.
 *  R3  Saltos múltiples: 3+ saltos de línea consecutivos → 2 (un solo bloque
 *      en blanco); espacios/blank lines al inicio y final del documento fuera.
 *  R4  Estilo de bullet: `* ` y `+ ` → `- ` (mismo nivel de indentación).
 *  R5  Espaciado tras marcador de lista/cita/encabezado: se colapsa a un
 *      espacio (`-   x` → `- x`, `>  x` → `> x`, `##   T` → `## T`).
 *      Los `#` de cierre de un encabezado ATX (`## T ##`) se eliminan.
 *  R6  Delimitador de lista ordenada: `1)` → `1.`.
 *  R7  Estilo de énfasis: `_x_` → `*x*` y `__x__` → `**x**` (solo cuando el
 *      subrayado delimita de verdad — no snake_case ni interiores de palabra).
 *  R8  Escapes de backslash sobre puntuación (`\*`, `\_`, `\[`, `\.`, `\<`…)
 *      → el carácter sin escape. El serializador escapa defensivamente
 *      caracteres que en la posición concreta no cambian el render.
 *  R9  Tablas GFM: se colapsa el padding de celdas (`| a  |` → `| a |`) y la
 *      fila delimitadora se canoniza conservando alineación
 *      (`:--------` → `:---`, `----` → `---`).
 *  R10 Soft breaks: un salto de línea simple dentro de un párrafo, cita o
 *      ítem de lista se pliega a un espacio (el render de un softbreak ES un
 *      espacio, y el serializador emite el párrafo en una sola línea). Los
 *      hard breaks (R2, terminan en `\`) NUNCA se pliegan.
 *  R7/R8 no se aplican dentro de inline code (`…`).
 */
export function normalizeMarkdown(md: string): string {
  // R1
  // R2 (hard breaks): `≥2 espacios + \n + línea con contenido` → `\` + `\n`.
  // Se aplica como pre-pass global; dentro de un fence mutaría ambos lados por
  // igual (el serializador conserva el código byte a byte), así que la
  // comparación sigue siendo consistente.
  const unified = md
    .replace(/\r\n?/g, "\n")
    .replace(/ {2,}\n(?=[^\n]*\S)/g, "\\\n");

  interface Line {
    text: string;
    code: boolean;
  }
  const norm: Line[] = [];
  let fence: string | null = null;

  for (const rawLine of unified.split("\n")) {
    const open = rawLine.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (fence) {
      norm.push({ text: rawLine, code: true }); // dentro de código: intacta
      if (open && open[1][0] === fence[0] && open[1].length >= fence.length) {
        fence = null;
      }
      continue;
    }
    if (open) {
      fence = open[1];
      norm.push({ text: rawLine, code: true });
      continue;
    }
    norm.push({ text: normalizeTextLine(rawLine), code: false });
  }

  return (
    unfoldSoftBreaks(norm)
      .join("\n")
      // R3 — colapso de saltos múltiples
      .replace(/\n{3,}/g, "\n\n")
      .replace(/^\n+/, "")
      .replace(/\n+$/, "")
  );
}

/** ¿Inicia esta línea un bloque nuevo? (no puede ser continuación de párrafo) */
const BLOCK_START_RE = new RegExp(
  [
    /^\s{0,3}#{1,6}(\s|$)/.source, // encabezado ATX
    /^\s*([-*+]|\d{1,9}[.)])(\s|$)/.source, // ítem de lista
    /^\s*>/.source, // cita
    /^\s*\|/.source, // fila de tabla
    /^\s{0,3}(-{3,}|(\*\s*){3,}|(_\s*){3,})\s*$/.source, // hr
    /^\s{0,3}=+\s*$/.source, // subrayado setext
  ].join("|"),
);

/** ¿Puede esta línea recibir una continuación plegada? */
function acceptsContinuation(line: string): boolean {
  if (line.trim() === "") return false;
  if (line.endsWith("\\")) return false; // hard break real (R2)
  if (/^\s{0,3}#{1,6}(\s|$)/.test(line)) return false; // encabezado
  if (/^\s*\|/.test(line)) return false; // fila de tabla
  if (/^\s{0,3}(-{3,}|(\*\s*){3,}|(_\s*){3,})\s*$/.test(line)) return false; // hr
  return true;
}

/** R10 — pliega soft breaks (párrafos, citas e ítems de lista multi-línea). */
function unfoldSoftBreaks(lines: { text: string; code: boolean }[]): string[] {
  const out: string[] = [];
  let prevWasCode = false;

  for (const line of lines) {
    if (line.code) {
      out.push(line.text);
      prevWasCode = true;
      continue;
    }
    const prev = out.length > 0 ? out[out.length - 1] : null;
    const curr = line.text;

    if (prev !== null && !prevWasCode && acceptsContinuation(prev) && curr.trim() !== "") {
      // Continuación plana (incluye la continuación «lazy» de una cita).
      if (!BLOCK_START_RE.test(curr)) {
        out[out.length - 1] = `${prev} ${curr.trim()}`;
        continue;
      }
      // Continuación dentro de una cita: `> texto` tras otra línea `> …`.
      if (/^\s*>/.test(prev) && /^\s*>/.test(curr)) {
        const content = curr.replace(/^\s*(?:>\s?)+/, "");
        if (content.trim() !== "" && !BLOCK_START_RE.test(content)) {
          out[out.length - 1] = `${prev} ${content.trim()}`;
          continue;
        }
      }
    }
    out.push(curr);
    prevWasCode = false;
  }
  return out;
}

/** Normaliza una línea fuera de fences de código. */
function normalizeTextLine(line: string): string {
  // R2 — espacios finales (los hard breaks ya se canonizaron a `\` en el
  // pre-pass de normalizeMarkdown; el `\` final no es whitespace y se queda).
  let text = line.replace(/\s+$/, "");

  // R9 — tablas GFM (fila completa `| … |`): padding + fila delimitadora
  if (/^\s*\|.*\|\s*$/.test(text)) {
    return normalizeTableRow(text);
  }

  // R4 — estilo de bullet
  text = text.replace(/^(\s*)[*+](\s+)/, "$1-$2");
  // R6 — delimitador de lista ordenada `1)` → `1.`
  text = text.replace(/^(\s*)(\d{1,9})\)(\s+)/, "$1$2.$3");
  // R5 — espaciado tras marcadores (lista, cita, encabezado) + `#` de cierre
  text = text.replace(/^(\s*)(-|\d{1,9}\.)\s+/, "$1$2 ");
  text = text.replace(/^(\s*)>\s+/, "$1> ");
  if (/^\s{0,3}#{1,6}(\s|$)/.test(text)) {
    text = text
      .replace(/^(\s{0,3})(#{1,6})\s+/, "$2 ")
      .replace(/\s+#+\s*$/, "");
  }

  // R7/R8 — transformaciones inline, protegiendo inline code
  text = mapOutsideInlineCode(text, (chunk) =>
    chunk
      // R8 — quitar escapes defensivos sobre puntuación
      .replace(/\\([\\`*_{}[\]()#+\-.!<>|~"'])/g, "$1")
      // R7 — énfasis: __x__ → **x**, _x_ → *x*
      .replace(/(?<![\w\\])__(?!\s)([^_\n]+?)(?<!\s)__(?![\w])/g, "**$1**")
      .replace(/(?<![\w\\])_(?!\s)([^_\n]+?)(?<!\s)_(?![\w])/g, "*$1*"),
  );

  return text;
}

/** R9 — canoniza una fila de tabla GFM (padding y fila delimitadora). */
function normalizeTableRow(row: string): string {
  const trimmed = row.trim();
  // Sin el `|` inicial/final para partir celdas (los pipes escapados no se
  // parten: contenido con `\|` es raro y caería en «no seguro», que es válido).
  const inner = trimmed.replace(/^\|/, "").replace(/\|$/, "");
  const cells = inner.split("|").map((cell) => {
    const c = cell.trim();
    const delim = c.match(/^(:?)-+(:?)$/);
    if (delim) return `${delim[1]}---${delim[2]}`;
    return c;
  });
  return `| ${cells.join(" | ")} |`;
}

/** Aplica `fn` solo a los tramos de la línea fuera de inline code. */
function mapOutsideInlineCode(line: string, fn: (chunk: string) => string): string {
  const parts: string[] = [];
  let rest = line;
  const CODE_SPAN = /(`+)([^`]|[^`][\s\S]*?[^`])\1/;
  for (;;) {
    const m = rest.match(CODE_SPAN);
    if (!m || m.index === undefined) {
      parts.push(fn(rest));
      break;
    }
    parts.push(fn(rest.slice(0, m.index)));
    parts.push(m[0]); // el code span, intacto
    rest = rest.slice(m.index + m[0].length);
  }
  return parts.join("");
}

// ─── Veredicto ────────────────────────────────────────────────────────────────

/**
 * ¿Es seguro abrir `md` en el editor visual?
 *
 * `serializeFn` es el roundtrip REAL del editor (Markdown → ProseMirror →
 * Markdown), inyectado para mantener este módulo puro. El veredicto es
 * `safe` solo si (a) no hay HTML crudo y (b) `normalizeMarkdown(md)` es
 * idéntico a `normalizeMarkdown(serializeFn(md))`.
 */
export function markdownRoundtripSafe(
  md: string,
  serializeFn: (md: string) => string,
): RoundtripVerdict {
  if (hasRawHtml(md)) {
    return { safe: false, reason: "contiene HTML crudo" };
  }

  let roundtripped: string;
  try {
    roundtripped = serializeFn(md);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { safe: false, reason: `el serializador falló: ${message}` };
  }

  const a = normalizeMarkdown(md);
  const b = normalizeMarkdown(roundtripped);
  if (a === b) return { safe: true };

  return { safe: false, reason: firstDiff(a, b) };
}

/** Localiza la primera línea distinta entre dos normalizaciones (diagnóstico). */
function firstDiff(a: string, b: string): string {
  const linesA = a.split("\n");
  const linesB = b.split("\n");
  const len = Math.max(linesA.length, linesB.length);
  for (let i = 0; i < len; i++) {
    if (linesA[i] !== linesB[i]) {
      return `diferencia tras roundtrip (línea ${i + 1}): ${JSON.stringify(
        linesA[i] ?? "<fin>",
      )} → ${JSON.stringify(linesB[i] ?? "<fin>")}`;
    }
  }
  return "diferencia tras roundtrip";
}
