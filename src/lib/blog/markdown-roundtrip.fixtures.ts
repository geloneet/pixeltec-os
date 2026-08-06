/**
 * B-PR8 — Fixtures del roundtrip Markdown.
 *
 * Compartidos entre el test puro (`markdown-roundtrip.test.ts`, node) y el
 * test con el serializador REAL de Tiptap (`tiptap-roundtrip.test.ts`, jsdom).
 * `expectSafe` es el veredicto esperado de `markdownRoundtripSafe` con el
 * serializador real.
 */

export interface RoundtripFixture {
  name: string;
  md: string;
  expectSafe: boolean;
}

export const ROUNDTRIP_FIXTURES: RoundtripFixture[] = [
  {
    name: "encabezados H2/H3",
    md: "## Sección\n\nTexto introductorio.\n\n### Subsección\n\nMás texto.",
    expectSafe: true,
  },
  {
    name: "listas anidadas (bullets)",
    md: "- uno\n- dos\n  - dos punto uno\n  - dos punto dos\n- tres",
    expectSafe: true,
  },
  {
    name: "listas anidadas (ordenadas)",
    md: "1. primero\n2. segundo\n   1. anidado\n   2. otro\n3. tercero",
    expectSafe: true,
  },
  {
    name: "blockquote multilínea",
    md: "> Una cita\n> de dos líneas.",
    expectSafe: true,
  },
  {
    name: "tabla GFM",
    md: "| Col A | Col B |\n| --- | --- |\n| a1 | b1 |\n| a2 | b2 |",
    expectSafe: true,
  },
  {
    name: "tabla GFM con padding (sin alineación)",
    md: "| Columna    | Valor |\n|------------|-------|\n| fila       |    42 |",
    expectSafe: true,
  },
  {
    // El serializador de tiptap-markdown DESCARTA la alineación de columnas
    // (`:---`/`---:` → `---`): perderla en silencio no es aceptable, así que
    // estas tablas abren en modo Markdown.
    name: "tabla GFM con alineación (el editor no la conserva)",
    md: "| Columna | Valor |\n|:--------|------:|\n| fila    |    42 |",
    expectSafe: false,
  },
  {
    name: "imagen",
    md: "![Diagrama de arquitectura](https://example.com/diagrama.png)",
    expectSafe: true,
  },
  {
    name: "enlaces",
    md: "Visita [PixelTEC](https://pixeltec.mx) para más información.",
    expectSafe: true,
  },
  {
    name: "código con fence y lenguaje",
    md: "```ts\nconst x: number = 1;\nconsole.log(x < 2 && x > 0);\n```",
    expectSafe: true,
  },
  {
    name: "fence mermaid",
    md: "```mermaid\ngraph TD;\n  A-->B;\n  B-->C;\n```",
    expectSafe: true,
  },
  {
    name: "énfasis mixto (asteriscos)",
    md: "Texto con **negritas**, *cursivas* y ***ambas***.",
    expectSafe: true,
  },
  {
    name: "énfasis mixto (guiones bajos)",
    md: "Con _cursiva_ y __negrita__ en estilo subrayado.",
    expectSafe: true,
  },
  {
    name: "saltos duros (dos espacios)",
    md: "Línea uno  \nLínea dos",
    expectSafe: true,
  },
  {
    name: "saltos duros (backslash)",
    md: "Línea uno\\\nLínea dos",
    expectSafe: true,
  },
  {
    name: "código inline",
    md: "Usa `npm run build` para compilar y `a < b` como condición.",
    expectSafe: true,
  },
  {
    name: "separador horizontal",
    md: "Antes\n\n---\n\nDespués",
    expectSafe: true,
  },
  {
    name: "autolink",
    md: "Mira <https://example.com> ahora.",
    expectSafe: true,
  },
  {
    name: "párrafo con soft wraps",
    md: "Una frase larga\npartida en varias\nlíneas del archivo.",
    expectSafe: true,
  },
  {
    name: "artículo combinado",
    md: [
      "## Introducción",
      "",
      "Un párrafo con **negritas**, [un enlace](https://pixeltec.mx) y `código`.",
      "",
      "### Detalle",
      "",
      "- punto uno",
      "- punto dos",
      "  - anidado",
      "",
      "> Cita relevante.",
      "",
      "```sql\nSELECT 1;\n```",
      "",
      "![Alt](https://example.com/i.png)",
    ].join("\n"),
    expectSafe: true,
  },
  // ── No seguros ──────────────────────────────────────────────────────────────
  {
    name: "HTML crudo: iframe",
    md: 'Antes\n\n<iframe src="https://example.com/embed"></iframe>\n\nDespués',
    expectSafe: false,
  },
  {
    name: "HTML crudo: div inline",
    md: 'Texto con <div class="callout">un bloque</div> incrustado.',
    expectSafe: false,
  },
  {
    name: "HTML crudo: comentario",
    md: "Texto\n\n<!-- nota interna -->\n\nMás texto.",
    expectSafe: false,
  },
  {
    name: "H1 en el cuerpo (el editor solo conserva H2/H3)",
    md: "# Título dentro del cuerpo\n\nTexto.",
    expectSafe: false,
  },
];
