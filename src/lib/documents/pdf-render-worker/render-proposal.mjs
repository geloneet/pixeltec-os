// Worker de render de PDF — proceso Node plano, invocado vía child_process
// desde src/app/api/documents/proposal-pdf/route.tsx.
//
// POR QUÉ EXISTE ESTE ARCHIVO SEPARADO: cualquier archivo que el bundler de
// Next.js compile para el servidor (Turbopack o webpack, esté bajo src/app/
// o no) termina resolviendo "react" contra la copia interna que Next vendoriza
// (next/dist/compiled/react) en vez de la de node_modules/react. El reconciler
// interno de @react-pdf/renderer no reconoce los elementos creados con esa
// copia como React elements válidos -> "Objects are not valid as a React
// child" (React error #31). Se probó: downgrade de versión, serverExternalPackages,
// webpack vs Turbopack, y mover el archivo fuera de src/app — los 4 fallaron
// igual. La única forma confirmada de evitarlo es correr el render en un
// proceso de Node completamente ajeno al bundler de Next, con su propia
// resolución de módulos limpia. Por eso este archivo:
//   - es .mjs plano (sin TypeScript, sin JSX) para no requerir ningún loader
//   - nunca se importa desde código que Next compile; solo se invoca por ruta
//     de archivo vía child_process.execFile en el proceso padre
//   - usa React.createElement directamente (h) en vez de JSX
//
// Uso: node render-proposal.mjs <inputJsonPath> <outputPdfPath>
// Lee el Proposal (JSON) de inputJsonPath, escribe el PDF binario en outputPdfPath.
//
// ESTRUCTURA DEL DOCUMENTO (reconstruida sobre docs/Propuesta_Villa_Don_Eduardo_
// PIXELTEC_1.pdf — solo armazón/secciones, la identidad visual sigue siendo la
// de PixelTEC): portada con "Preparado para / Preparado por", secciones
// numeradas (una por página) con eyebrow + número + título, tabla de
// "Inversión del proyecto" (concepto + monto + cadencia de pago), condiciones
// comerciales y página de cierre con firma.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  Svg,
  Defs,
  RadialGradient,
  Stop,
  Rect,
  Line,
  Link,
  Font,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

const h = React.createElement;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// __dirname: src/lib/documents/pdf-render-worker — subir 4 niveles llega a la raíz del proyecto.
const PROJECT_ROOT = path.resolve(__dirname, "../../../..");
const FONTS_DIR = path.join(PROJECT_ROOT, "src/lib/documents/fonts");
const LOGO_PATH = path.join(PROJECT_ROOT, "public", "ptlogox.png");

Font.register({
  family: "Poppins",
  fonts: [
    { src: path.join(FONTS_DIR, "Poppins-Regular.ttf"), fontWeight: 400 },
    // Itálica real: sin esta variante, un `*texto*` en markdown (fontStyle:italic)
    // no resuelve fuente y @react-pdf tira "Could not resolve font" → 500 en toda
    // la propuesta. Ver render de renderInline/styles.italic.
    { src: path.join(FONTS_DIR, "Poppins-Italic.ttf"), fontWeight: 400, fontStyle: "italic" },
    { src: path.join(FONTS_DIR, "Poppins-SemiBold.ttf"), fontWeight: 600 },
    { src: path.join(FONTS_DIR, "Poppins-Bold.ttf"), fontWeight: 700 },
    { src: path.join(FONTS_DIR, "Poppins-ExtraBold.ttf"), fontWeight: 800 },
  ],
});
Font.registerHyphenationCallback((word) => [word]);

// ── Paleta — misma identidad que el dashboard (--primary real, no inventado) ──
const COLOR = {
  coverBg: "#0A0D14",
  coverGrid: "#2196F3",
  coverGlow: "#2196F3",
  white: "#FFFFFF",
  mutedOnDark: "#8B93A7",
  faintOnDark: "#5B6478",
  primary: "#2196F3",
  primaryDim: "rgba(33,150,243,0.12)",
  primaryBorderOnDark: "#25436B",
  ink: "#0F172A",
  body: "#334155",
  muted: "#64748B",
  faint: "#94A3B8",
  border: "#E4E9F0",
  cardBg: "#F8FAFC",
  success: "#15803D",
  successBg: "#F0FDF4",
  successBorder: "#BBF7D0",
};

const STATUS_LABEL = {
  borrador: "Borrador",
  enviada: "Pendiente de aprobación",
  vista: "Vista por el cliente",
  aceptada: "Aceptada",
  rechazada: "Rechazada",
  vencida: "Vencida",
};

const PHASES = [
  { n: "01", tag: "Inicio", label: "Discovery", desc: "Entendemos el problema real, el contexto del negocio y los objetivos detrás del proyecto." },
  { n: "02", tag: "Aprobación", label: "Diseño y arquitectura", desc: "Definimos la solución técnica y la experiencia antes de escribir una sola línea de código." },
  { n: "03", tag: "Construcción", label: "Desarrollo", desc: "Construcción iterativa, con avances visibles en cada etapa del proceso." },
  { n: "04", tag: "Revisión", label: "Validación", desc: "Pruebas, ajustes y revisión conjunta contigo antes del lanzamiento." },
  { n: "05", tag: "Entrega", label: "Entrega y capacitación", desc: "Puesta en producción y acompañamiento para tu equipo." },
];

const TERMS = [
  { label: "Anticipo", value: "Se requiere un anticipo para reservar el inicio del proyecto, conforme a lo acordado en el contrato de servicio." },
  { label: "Forma de pago", value: "Conforme a lo establecido en el contrato de servicio correspondiente a esta propuesta." },
  { label: "Vigencia de la propuesta", value: "Esta propuesta tiene una vigencia de 15 días naturales a partir de su fecha de emisión." },
  { label: "Qué no incluye", value: "Cualquier alcance, entregable o servicio no descrito explícitamente en esta propuesta." },
  { label: "Cambios fuera de alcance", value: "Cualquier solicitud adicional se evalúa y cotiza por separado antes de iniciar su desarrollo." },
];

// Etiquetas de cadencia de pago — mismas 5 frecuencias fijas del formulario
// (ver BILLING_FREQUENCY_LABELS en src/types/documents.ts; se repite aquí
// porque este worker no puede importar TypeScript).
const FREQ_LABEL = {
  unico: "Pago único",
  mensual: "Mensual",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};

function formatMXN(n) {
  const decimals = Number.isInteger(n) ? 0 : 2;
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

// Convierte "**negritas**"/"*cursivas*" en spans de Text anidados — sin esto
// los asteriscos salen literales (@react-pdf/renderer no interpreta
// markdown). react-pdf sí soporta <Text> anidado con su propio estilo como
// forma estándar de texto con estilos mixtos.
function renderInline(text) {
  // Sin marcadores → devuelve el string tal cual (ruta rápida). OJO: no usar
  // `parts.length <= 1` para esto — un texto que ES un solo span (ej. una
  // celda que es toda "**negrita**") también da un solo part y saldría con
  // los asteriscos crudos.
  if (!text.includes("*")) return text;
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter((p) => p !== "");
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return h(Text, { key: i, style: styles.bold }, part.slice(2, -2));
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return h(Text, { key: i, style: styles.italic }, part.slice(1, -1));
    }
    return part;
  });
}

function isTableSeparatorLine(line) {
  return /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?$/.test(line.trim());
}

function parseTableRow(line) {
  let l = line.trim();
  if (l.startsWith("|")) l = l.slice(1);
  if (l.endsWith("|")) l = l.slice(0, -1);
  return l.split("|").map((c) => c.trim());
}

function renderTable(rows, key) {
  // rows: array de líneas markdown (header, separador, cuerpo...).
  const header = parseTableRow(rows[0]);
  const bodyRows = rows.slice(2).map(parseTableRow);

  const headerRow = h(
    View,
    { style: styles.tableHeaderRow, key: "head" },
    header.map((cell, ci) =>
      h(View, { style: styles.tableCellHead, key: ci }, h(Text, { style: styles.tableCellHeadText }, renderInline(cell))))
  );

  // Sin wrap:false: una fila más alta que la página se pagina en vez de
  // encimarse sobre el resto del contenido.
  const bodyEls = bodyRows.map((row, ri) =>
    h(
      View,
      { style: styles.tableRow, key: `r${ri}` },
      header.map((_, ci) =>
        h(View, { style: styles.tableCell, key: ci }, h(Text, { style: styles.tableCellText }, renderInline(row[ci] ?? ""))))
    )
  );

  return h(View, { style: styles.table, key }, [headerRow, ...bodyEls]);
}

function renderListItem(marker, text, isOrdered, key) {
  return h(View, { style: styles.listItem, key }, [
    h(Text, { style: isOrdered ? styles.listNum : styles.listDotWrap, key: "m" },
      isOrdered ? marker : "•"),
    h(Text, { style: styles.listText, key: "t" }, renderInline(text)),
  ]);
}

// Renderiza markdown liviano (scope/solution/deliverables/benefits) que la IA
// genera con estructura rica: encabezados, tablas GFM (incluso pegadas a un
// encabezado sin línea en blanco), listas ordenadas/no ordenadas, reglas
// horizontales, **negritas**/*cursivas* y párrafos. @react-pdf no interpreta
// markdown, así que se arma a mano con Text/View que FLUYEN (sin wrap:false en
// contenedores multi-item) para que paginen en vez de encimarse. Se procesa
// LÍNEA POR LÍNEA (no bloque por bloque) para que un `## título` seguido sin
// línea en blanco de una tabla no rompa la detección.
function renderRichText(raw) {
  // Una regla horizontal colgando al final del texto, sin nada después, no
  // separa nada — es puramente vestigial. Además dispara un bug real de
  // @react-pdf/renderer: si el ÚLTIMO nodo del PDF completo es esta View
  // delgada (h: 0.75) justo después de una tabla, el motor de paginación
  // entra en bucle infinito y el proceso se cuelga (confirmado por
  // bisección: tabla+párrafo+hr-al-final cuelga; el mismo contenido con
  // cualquier texto después del hr renderiza normal). Se recorta antes de
  // parsear — no cambia nada visible, solo evita el nodo colgante.
  const trimmedTail = String(raw ?? "").replace(/(\n\s*(-{3,}|\*{3,}|_{3,})\s*)+$/, "");
  const lines = trimmedTail.split("\n").map((l) => l.trimEnd());
  const els = [];
  let i = 0;
  let k = 0;
  const trimmed = (n) => (lines[n] ?? "").trim();

  while (i < lines.length) {
    const line = trimmed(i);
    if (!line) { i++; continue; }

    // Regla horizontal
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      els.push(h(View, { style: styles.hr, key: `hr${k++}` }));
      i++; continue;
    }

    // Encabezado (# … ######). Tamaño según nivel.
    const hm = line.match(/^(#{1,6})\s+(.+)$/);
    if (hm) {
      const style = hm[1].length <= 1 ? styles.blockHeadingLg : styles.blockHeading;
      els.push(h(Text, { style, key: `h${k++}` }, renderInline(hm[2].trim())));
      i++; continue;
    }

    // Tabla GFM: línea actual con `|` y la siguiente es separador.
    if (line.includes("|") && isTableSeparatorLine(trimmed(i + 1))) {
      const tbl = [line, trimmed(i + 1)];
      i += 2;
      while (i < lines.length && trimmed(i).includes("|")) { tbl.push(trimmed(i)); i++; }
      els.push(renderTable(tbl, `tbl${k++}`));
      continue;
    }

    // Lista ordenada (1. / 1))
    if (/^\d+[.)]\s+/.test(line)) {
      while (i < lines.length && /^\d+[.)]\s+/.test(trimmed(i))) {
        const m = trimmed(i).match(/^(\d+)[.)]\s+(.+)$/);
        els.push(renderListItem(`${m[1]}.`, m[2].trim(), true, `li${k++}`));
        i++;
      }
      continue;
    }

    // Lista no ordenada (- / * / •)
    if (/^[-*•]\s+/.test(line)) {
      while (i < lines.length && /^[-*•]\s+/.test(trimmed(i))) {
        els.push(renderListItem(null, trimmed(i).replace(/^[-*•]\s+/, ""), false, `li${k++}`));
        i++;
      }
      continue;
    }

    // Párrafo: líneas consecutivas hasta una línea en blanco o un elemento especial.
    const para = [];
    while (i < lines.length) {
      const l = trimmed(i);
      if (!l) break;
      if (/^(#{1,6}\s|[-*•]\s|\d+[.)]\s)/.test(l)) break;
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(l)) break;
      if (l.includes("|") && isTableSeparatorLine(trimmed(i + 1))) break;
      para.push(l);
      i++;
    }
    els.push(h(Text, { style: styles.paragraph, key: `p${k++}` }, renderInline(para.join(" "))));
  }
  return els;
}

function CoverMeta({ label, value }) {
  return h(View, { style: styles.coverMetaCol }, [
    h(Text, { style: styles.coverMetaLabel, key: "l" }, label),
    h(Text, { style: styles.coverMetaValue, key: "v" }, value),
  ]);
}

// Encabezado de sección numerada — eyebrow + "0X" + título grande + línea
// divisoria, una por página (break=true en todas menos la primera). Es el
// equivalente estructural de "01 La oportunidad" en la referencia.
function NumberedSection({ eyebrow, number, title, breakBefore, children }) {
  return h(View, { style: styles.numberedSection, break: Boolean(breakBefore), wrap: true }, [
    h(Text, { style: styles.numberedEyebrow, key: "eyebrow" }, eyebrow),
    h(View, { style: styles.numberedTitleRow, key: "title" }, [
      h(Text, { style: styles.numberedNumber, key: "n" }, number),
      h(Text, { style: styles.numberedTitle, key: "t" }, title),
    ]),
    h(View, { style: styles.numberedDivider, key: "div" }),
    children,
  ]);
}

// Encabezado menor (bar + label pequeño) — reservado para "Condiciones
// comerciales", que va como nota de cierre y no como sección numerada propia.
function MinorHeading({ label, children }) {
  return h(View, { style: styles.section }, [
    h(View, { style: styles.sectionLabelRow, key: "head" }, [
      h(View, { style: styles.sectionLabelBar, key: "bar" }),
      h(Text, { style: styles.sectionLabel, key: "label" }, label),
    ]),
    children,
  ]);
}

function ProposalDocument({ proposal }) {
  const monthYearStr = new Date(proposal.createdAt).toLocaleDateString("es-MX", {
    month: "long", year: "numeric",
  });
  const hasDeliverables = Boolean(proposal.deliverables && proposal.deliverables.trim());
  const hasBenefits = Boolean(proposal.benefits && proposal.benefits.trim());
  // Conceptos de inversión — mismo filtro que cleanPriceLines() en el form
  // (defensivo por si llega data vieja/sucia).
  const investItems = (proposal.billingItemDrafts ?? []).filter((i) => i && i.concept && i.amount > 0);

  const coverGridLines = [
    ...Array.from({ length: 13 }, (_, i) =>
      h(Line, { key: `v${i}`, x1: i * 48, y1: 0, x2: i * 48, y2: 842, stroke: COLOR.coverGrid, strokeWidth: 0.5, strokeOpacity: 0.16 })),
    ...Array.from({ length: 18 }, (_, i) =>
      h(Line, { key: `h${i}`, x1: 0, y1: i * 48, x2: 595, y2: i * 48, stroke: COLOR.coverGrid, strokeWidth: 0.5, strokeOpacity: 0.16 })),
  ];

  const coverPage = h(Page, { size: "A4", style: styles.coverPage, key: "cover" }, [
    h(View, { style: styles.coverBgLayer, fixed: true, key: "bg" },
      h(Svg, { style: { width: "100%", height: "100%" }, viewBox: "0 0 595 842" }, [
        h(Defs, { key: "defs" }, [
          h(RadialGradient, { id: "coverGlow", cx: "12%", cy: "8%", fr: "55%", key: "g1" }, [
            h(Stop, { offset: "0", stopColor: COLOR.coverGlow, stopOpacity: 0.35, key: "s1" }),
            h(Stop, { offset: "1", stopColor: COLOR.coverGlow, stopOpacity: 0, key: "s2" }),
          ]),
          h(RadialGradient, { id: "coverGlow2", cx: "95%", cy: "78%", fr: "45%", key: "g2" }, [
            h(Stop, { offset: "0", stopColor: COLOR.coverGlow, stopOpacity: 0.16, key: "s1" }),
            h(Stop, { offset: "1", stopColor: COLOR.coverGlow, stopOpacity: 0, key: "s2" }),
          ]),
        ]),
        h(Rect, { x: 0, y: 0, width: 595, height: 842, fill: "url(#coverGlow)", key: "r1" }),
        h(Rect, { x: 0, y: 0, width: 595, height: 842, fill: "url(#coverGlow2)", key: "r2" }),
        ...coverGridLines,
      ])),
    h(View, { style: styles.coverContent, key: "content" }, [
      h(Image, { src: LOGO_PATH, style: styles.coverLogo, key: "logo" }),
      h(Text, { style: styles.coverEyebrow, key: "eyebrow" }, "PROPUESTA DE PROYECTO"),
      h(Text, { style: styles.coverTitle, key: "title" }, proposal.title),
      h(View, { style: styles.coverMetaRow, key: "meta" }, [
        h(CoverMeta, { label: "Preparado para", value: proposal.clientName, key: "m1" }),
        h(CoverMeta, { label: "Preparado por", value: `PIXELTEC · ${monthYearStr}`, key: "m2" }),
        h(CoverMeta, { label: "Referencia", value: proposal.reference ?? "—", key: "m3" }),
      ]),
    ]),
    h(View, { style: styles.coverFooterRow, key: "footer" }, [
      h(View, { style: styles.statusBadge, key: "badge" }, [
        h(View, { style: styles.statusDot, key: "dot" }),
        h(Text, { style: styles.statusBadgeText, key: "text" }, STATUS_LABEL[proposal.status]),
      ]),
      h(Text, { style: styles.coverVersion, key: "version" }, `v${proposal.currentVersion ?? 1}`),
    ]),
  ]);

  // ── Cuerpo de "El proceso, paso a paso" — timeline (si existe) + fases ──
  const processBody = [
    proposal.timeline && h(Text, { style: styles.paragraph, key: "timeline-intro" }, [
      h(Text, { style: styles.bold, key: "b" }, "Tiempo estimado: "),
      proposal.timeline,
    ]),
    h(View, { style: styles.phaseList, key: "phases" },
      PHASES.map((phase, i) =>
        h(View, { style: styles.phaseRow, wrap: false, key: phase.n }, [
          h(View, { style: styles.phaseNumberCol, key: "col" }, [
            h(View, { style: styles.phaseNumberCircle, key: "circle" },
              h(Text, { style: styles.phaseNumberText }, phase.n)),
            i < PHASES.length - 1 && h(View, { style: styles.phaseConnector, key: "connector" }),
          ].filter(Boolean)),
          h(View, { style: styles.phaseTextCol, key: "text" }, [
            h(View, { style: styles.phaseTextTop, key: "top" }, [
              h(Text, { style: styles.phaseLabel, key: "label" }, phase.label),
              h(Text, { style: styles.phaseTag, key: "tag" }, phase.tag.toUpperCase()),
            ]),
            h(Text, { style: styles.phaseDesc, key: "desc" }, phase.desc),
          ]),
        ]))),
  ].filter(Boolean);

  // ── Cuerpo de "Inversión del proyecto" — tabla concepto/monto/cadencia ──
  const investmentBody = [
    h(Text, { style: styles.paragraph, key: "intro" },
      "Detalle de la inversión requerida para este proyecto, por concepto."),
    h(View, { style: styles.investTable, key: "table" }, [
      h(View, { style: styles.investTableHeaderRow, key: "head" }, [
        h(Text, { style: styles.investTableHeaderConcept, key: "c" }, "CONCEPTO"),
        h(Text, { style: styles.investTableHeaderAmount, key: "a" }, "INVERSIÓN"),
      ]),
      ...investItems.map((item, i) =>
        h(View, { style: styles.investTableRow, wrap: false, key: `row${i}` }, [
          h(Text, { style: styles.investConceptText, key: "c" }, item.concept),
          h(View, { style: styles.investAmountCol, key: "a" }, [
            h(Text, { style: styles.investAmountValue, key: "v" }, formatMXN(item.amount)),
            h(Text, { style: styles.investFreqLabel, key: "f" }, `MXN · ${FREQ_LABEL[item.frequency] ?? item.frequency}`),
          ]),
        ])),
    ]),
    h(Text, { style: styles.investNote, key: "note" },
      "Los montos están en pesos mexicanos (MXN) y no incluyen IVA; si requiere factura, se agrega el 16% correspondiente."),
  ];

  // ── Secciones numeradas — se numeran de forma secuencial según lo que
  // realmente esté presente (sin huecos si falta solution/deliverables/benefits).
  const sectionDefs = [
    { eyebrow: "EL PROYECTO", title: "La oportunidad", present: true, body: () => renderRichText(proposal.scope) },
    { eyebrow: "LA SOLUCIÓN", title: "Qué vamos a construir", present: Boolean(proposal.solution), body: () => renderRichText(proposal.solution) },
    { eyebrow: "LO QUE INCLUYE, EN CONCRETO", title: "Especificaciones del proyecto", present: hasDeliverables, body: () => renderRichText(proposal.deliverables) },
    { eyebrow: "CÓMO TRABAJAMOS", title: "El proceso, paso a paso", present: true, body: () => processBody },
    { eyebrow: "LA INVERSIÓN", title: "Inversión del proyecto", present: investItems.length > 0, body: () => investmentBody },
    { eyebrow: "POR QUÉ PIXELTEC", title: "Beneficios", present: hasBenefits, body: () => renderRichText(proposal.benefits) },
  ];

  const sections = [];
  let n = 0;
  for (const def of sectionDefs) {
    if (!def.present) continue;
    n++;
    sections.push(h(NumberedSection, {
      eyebrow: def.eyebrow,
      number: String(n).padStart(2, "0"),
      title: def.title,
      breakBefore: n > 1,
      key: `sec-${n}`,
    }, def.body()));
  }

  if (proposal.status === "aceptada") {
    sections.push(h(View, { style: styles.acceptedBanner, wrap: false, key: "accepted" },
      h(Text, { style: styles.acceptedText },
        `Propuesta aceptada${proposal.acceptedAt ? ` el ${new Date(proposal.acceptedAt).toLocaleDateString("es-MX")}` : ""}`)));
  }

  sections.push(h(MinorHeading, { label: "Condiciones comerciales", key: "sec-terms" },
    h(View, { style: styles.termsCard },
      TERMS.map((term) =>
        h(View, { style: styles.termRow, wrap: false, key: term.label }, [
          h(Text, { style: styles.termLabel, key: "label" }, term.label),
          h(Text, { style: styles.termValue, key: "value" }, term.value),
        ])))));

  sections.push(h(View, { style: styles.closing, break: true, wrap: false, key: "closing" }, [
    h(Image, { src: LOGO_PATH, style: styles.closingLogo, key: "logo" }),
    h(Text, { style: styles.closingTitle, key: "title" }, "Gracias por confiar en nosotros."),
    h(Text, { style: styles.closingSub, key: "sub" }, "Estamos listos para comenzar cuando tú lo estés."),
    h(View, { style: styles.closingContactRow, key: "contact" }, [
      h(Link, { src: "mailto:contacto@pixeltec.mx", style: styles.closingContactLink, key: "email" }, "contacto@pixeltec.mx"),
      h(Text, { style: styles.closingDot, key: "d1" }, "·"),
      h(Link, { src: "https://pixeltec.mx", style: styles.closingContactLink, key: "web" }, "pixeltec.mx"),
      h(Text, { style: styles.closingDot, key: "d2" }, "·"),
      h(Link, { src: "https://api.whatsapp.com/send?phone=523221378336", style: styles.closingContactLink, key: "wa" }, "+52 322 137 8336"),
    ]),
    h(View, { style: styles.closingSignature, key: "signature" }, [
      h(Text, { style: styles.closingSignatureName, key: "name" }, "Miguel Robles"),
      h(Text, { style: styles.closingSignatureRole, key: "role" }, "Fundador & Lead Architect · PIXELTEC"),
    ]),
  ]));

  const contentPage = h(Page, { size: "A4", style: styles.contentPage, key: "content" }, [
    h(View, { style: styles.pageHeader, fixed: true, key: "header" }, [
      h(Image, { src: LOGO_PATH, style: styles.pageHeaderLogo, key: "logo" }),
      h(Text, { style: styles.pageHeaderWordmark, key: "word" }, "PixelTEC"),
      h(View, { style: { flex: 1 }, key: "spacer" }),
      h(Text, { style: styles.pageHeaderRef, key: "ref" }, proposal.reference ?? ""),
    ]),
    ...sections,
    h(Text, {
      style: styles.pageFooter,
      fixed: true,
      key: "footer",
      render: ({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`,
    }),
  ]);

  return h(Document, { title: `${proposal.reference ?? "Propuesta"} — ${proposal.title}` }, [
    coverPage,
    contentPage,
  ]);
}

const styles = StyleSheet.create({
  coverPage: {
    fontFamily: "Poppins",
    backgroundColor: COLOR.coverBg,
    padding: 56,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  coverBgLayer: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  coverContent: { marginTop: 160 },
  coverLogo: { width: 46, height: 49 },
  coverEyebrow: {
    marginTop: 28, fontSize: 10, fontWeight: 700, color: COLOR.primary,
    letterSpacing: 3, textTransform: "uppercase",
  },
  coverTitle: {
    marginTop: 14, fontSize: 30, fontWeight: 800, color: COLOR.white, lineHeight: 1.25,
  },
  coverMetaRow: { flexDirection: "row", marginTop: 48, gap: 40 },
  coverMetaCol: { display: "flex", flexDirection: "column" },
  coverMetaLabel: {
    fontSize: 8, fontWeight: 700, color: COLOR.faintOnDark, letterSpacing: 1.5,
    textTransform: "uppercase", marginBottom: 6,
  },
  coverMetaValue: { fontSize: 12, fontWeight: 600, color: COLOR.white },
  coverFooterRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  statusBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: 1, borderColor: COLOR.primaryBorderOnDark, borderRadius: 999,
    paddingVertical: 6, paddingHorizontal: 12, backgroundColor: COLOR.primaryDim,
  },
  statusDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: COLOR.primary },
  statusBadgeText: { fontSize: 8.5, fontWeight: 600, color: "#BFE0FF" },
  coverVersion: { fontSize: 9, color: COLOR.mutedOnDark, fontWeight: 400 },

  contentPage: {
    fontFamily: "Poppins",
    backgroundColor: COLOR.white,
    paddingTop: 64,
    paddingBottom: 56,
    paddingHorizontal: 56,
    color: COLOR.body,
  },
  pageHeader: {
    position: "absolute", top: 0, left: 56, right: 56, height: 40,
    flexDirection: "row", alignItems: "center", gap: 8,
    borderBottomWidth: 0.75, borderBottomColor: COLOR.border,
  },
  pageHeaderLogo: { width: 14, height: 15 },
  pageHeaderWordmark: { fontSize: 9, fontWeight: 700, color: COLOR.ink, letterSpacing: 0.5 },
  pageHeaderRef: { fontSize: 8, color: COLOR.faint, fontWeight: 400 },
  pageFooter: {
    position: "absolute", bottom: 24, left: 56, right: 56,
    textAlign: "center", fontSize: 8, color: COLOR.faint,
  },

  // Encabezado de sección numerada (01, 02, …) — una por página.
  numberedSection: { marginBottom: 22 },
  numberedEyebrow: {
    fontSize: 9, fontWeight: 700, color: COLOR.primary, letterSpacing: 1.5,
    textTransform: "uppercase", marginBottom: 8,
  },
  numberedTitleRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  numberedNumber: { fontSize: 13, fontWeight: 800, color: COLOR.primary },
  numberedTitle: { fontSize: 18, fontWeight: 800, color: COLOR.ink },
  numberedDivider: { height: 1, backgroundColor: COLOR.border, marginTop: 10, marginBottom: 16 },

  // Encabezado menor (Condiciones comerciales).
  section: { marginBottom: 22 },
  sectionLabelRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  sectionLabelBar: { width: 3, height: 11, backgroundColor: COLOR.primary, borderRadius: 1.5 },
  sectionLabel: {
    fontSize: 9, fontWeight: 700, color: COLOR.primary, letterSpacing: 1.5, textTransform: "uppercase",
  },

  paragraph: { fontSize: 10.5, lineHeight: 1.6, color: COLOR.body, marginBottom: 8 },
  blockHeading: { fontSize: 11.5, fontWeight: 700, color: COLOR.ink, marginTop: 8, marginBottom: 5 },
  blockHeadingLg: { fontSize: 13, fontWeight: 700, color: COLOR.ink, marginTop: 12, marginBottom: 6 },
  listItem: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 5 },
  listDotWrap: { fontSize: 10.5, lineHeight: 1.5, color: COLOR.primary, width: 12 },
  listNum: { fontSize: 10.5, lineHeight: 1.5, color: COLOR.primary, fontWeight: 700, width: 18 },
  listText: { fontSize: 10.5, lineHeight: 1.5, color: COLOR.body, flex: 1 },
  bold: { fontWeight: 700, color: COLOR.ink },
  italic: { fontStyle: "italic" },
  hr: { height: 0.75, backgroundColor: COLOR.border, marginVertical: 10 },

  table: {
    display: "flex", flexDirection: "column", marginBottom: 10,
    borderWidth: 0.75, borderColor: COLOR.border, borderRadius: 6, overflow: "hidden",
  },
  tableHeaderRow: { flexDirection: "row", backgroundColor: COLOR.cardBg },
  tableRow: { flexDirection: "row", borderTopWidth: 0.75, borderTopColor: COLOR.border },
  tableCellHead: { flex: 1, padding: 6, borderRightWidth: 0.75, borderRightColor: COLOR.border },
  tableCell: { flex: 1, padding: 6, borderRightWidth: 0.75, borderRightColor: COLOR.border },
  tableCellHeadText: { fontSize: 8.5, fontWeight: 700, color: COLOR.ink },
  tableCellText: { fontSize: 8.5, lineHeight: 1.4, color: COLOR.body },

  // Tabla de Inversión del proyecto (concepto | monto + cadencia).
  investTable: {
    display: "flex", flexDirection: "column", marginBottom: 10,
    borderWidth: 0.75, borderColor: COLOR.border, borderRadius: 6, overflow: "hidden",
  },
  investTableHeaderRow: {
    flexDirection: "row", backgroundColor: COLOR.ink, paddingVertical: 8, paddingHorizontal: 10,
  },
  investTableHeaderConcept: {
    flex: 1, fontSize: 8, fontWeight: 700, color: COLOR.white, letterSpacing: 1, textTransform: "uppercase",
  },
  investTableHeaderAmount: {
    fontSize: 8, fontWeight: 700, color: COLOR.white, letterSpacing: 1, textTransform: "uppercase", textAlign: "right",
  },
  investTableRow: {
    flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 10,
    borderTopWidth: 0.75, borderTopColor: COLOR.border,
  },
  investConceptText: { flex: 1, fontSize: 10, lineHeight: 1.45, color: COLOR.ink, paddingRight: 10 },
  investAmountCol: { alignItems: "flex-end" },
  investAmountValue: { fontSize: 12, fontWeight: 800, color: COLOR.ink },
  investFreqLabel: { fontSize: 7.5, color: COLOR.muted, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.5 },
  investNote: { fontSize: 8, lineHeight: 1.4, color: COLOR.faint, fontStyle: "italic" },

  acceptedBanner: {
    backgroundColor: COLOR.successBg, borderWidth: 0.75, borderColor: COLOR.successBorder,
    borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 22,
  },
  acceptedText: { fontSize: 9.5, fontWeight: 600, color: COLOR.success },

  phaseList: { display: "flex", flexDirection: "column" },
  phaseRow: { flexDirection: "row", gap: 14 },
  phaseNumberCol: { alignItems: "center", width: 26 },
  phaseNumberCircle: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: COLOR.primary,
    alignItems: "center", justifyContent: "center", backgroundColor: COLOR.white,
  },
  phaseNumberText: { fontSize: 7.5, fontWeight: 700, color: COLOR.primary },
  phaseConnector: { width: 1, flex: 1, minHeight: 18, backgroundColor: COLOR.border, marginTop: 2 },
  phaseTextCol: { flex: 1, paddingBottom: 16 },
  phaseTextTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 3 },
  phaseLabel: { fontSize: 10.5, fontWeight: 700, color: COLOR.ink },
  phaseTag: { fontSize: 7.5, fontWeight: 700, color: COLOR.primary, letterSpacing: 1 },
  phaseDesc: { fontSize: 9, lineHeight: 1.45, color: COLOR.muted },

  termsCard: {
    backgroundColor: COLOR.cardBg, borderWidth: 0.75, borderColor: COLOR.border,
    borderRadius: 8, padding: 14, display: "flex", flexDirection: "column", gap: 8,
  },
  termRow: { flexDirection: "row", gap: 10 },
  termLabel: { fontSize: 8.5, fontWeight: 700, color: COLOR.ink, width: 110, flexShrink: 0 },
  termValue: { fontSize: 8.5, lineHeight: 1.45, color: COLOR.muted, flex: 1 },

  closing: {
    marginTop: 28, paddingTop: 22, borderTopWidth: 0.75, borderTopColor: COLOR.border,
    alignItems: "center",
  },
  closingLogo: { width: 22, height: 24, marginBottom: 10 },
  closingTitle: { fontSize: 12, fontWeight: 700, color: COLOR.ink },
  closingSub: { fontSize: 9, color: COLOR.muted, marginTop: 3 },
  closingContactRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 },
  closingContactLink: { fontSize: 8.5, color: COLOR.primary, textDecoration: "none" },
  closingDot: { fontSize: 8.5, color: COLOR.faint },
  closingSignature: { marginTop: 24, alignItems: "center" },
  closingSignatureName: { fontSize: 10.5, fontWeight: 700, color: COLOR.ink },
  closingSignatureRole: { fontSize: 8.5, color: COLOR.muted, marginTop: 2 },
});

async function main() {
  const [, , inputJsonPath, outputPdfPath] = process.argv;
  if (!inputJsonPath || !outputPdfPath) {
    console.error("Uso: node render-proposal.mjs <inputJsonPath> <outputPdfPath>");
    process.exit(1);
  }
  const proposal = JSON.parse(readFileSync(inputJsonPath, "utf-8"));
  const pdf = await renderToBuffer(h(ProposalDocument, { proposal }));
  writeFileSync(outputPdfPath, pdf);
}

main().catch((err) => {
  console.error(err?.stack ?? String(err));
  process.exit(1);
});
