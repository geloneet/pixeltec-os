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
  { n: "01", label: "Discovery", desc: "Entendemos el problema real, el contexto del negocio y los objetivos detrás del proyecto." },
  { n: "02", label: "Diseño y arquitectura", desc: "Definimos la solución técnica y la experiencia antes de escribir una sola línea de código." },
  { n: "03", label: "Desarrollo", desc: "Construcción iterativa, con avances visibles en cada etapa del proceso." },
  { n: "04", label: "Validación", desc: "Pruebas, ajustes y revisión conjunta contigo antes del lanzamiento." },
  { n: "05", label: "Entrega y capacitación", desc: "Puesta en producción y acompañamiento para tu equipo." },
];

const TERMS = [
  { label: "Anticipo", value: "Se requiere un anticipo para reservar el inicio del proyecto, conforme a lo acordado en el contrato de servicio." },
  { label: "Forma de pago", value: "Conforme a lo establecido en el contrato de servicio correspondiente a esta propuesta." },
  { label: "Vigencia de la propuesta", value: "Esta propuesta tiene una vigencia de 15 días naturales a partir de su fecha de emisión." },
  { label: "Qué no incluye", value: "Cualquier alcance, entregable o servicio no descrito explícitamente en esta propuesta." },
  { label: "Cambios fuera de alcance", value: "Cualquier solicitud adicional se evalúa y cotiza por separado antes de iniciar su desarrollo." },
];

function parseBullets(raw) {
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  const bulletLines = lines.filter((l) => /^[-•*]\s+/.test(l));
  if (bulletLines.length === 0) return [];
  return lines.map((l) => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
}

// Convierte "**negritas**"/"*cursivas*" en spans de Text anidados — sin esto
// los asteriscos salen literales (@react-pdf/renderer no interpreta
// markdown). react-pdf sí soporta <Text> anidado con su propio estilo como
// forma estándar de texto con estilos mixtos.
function renderInline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter((p) => p !== "");
  if (parts.length <= 1) return text;
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

function renderTable(lines, key) {
  const header = parseTableRow(lines[0]);
  const bodyRows = lines.slice(2).map(parseTableRow);

  const headerRow = h(
    View,
    { style: styles.tableHeaderRow, key: "head", wrap: false },
    header.map((cell, ci) =>
      h(View, { style: styles.tableCellHead, key: ci }, h(Text, { style: styles.tableCellHeadText }, renderInline(cell))))
  );

  const rows = bodyRows.map((row, ri) =>
    h(
      View,
      { style: styles.tableRow, key: `r${ri}`, wrap: false },
      header.map((_, ci) =>
        h(View, { style: styles.tableCell, key: ci }, h(Text, { style: styles.tableCellText }, renderInline(row[ci] ?? ""))))
    )
  );

  return h(View, { style: styles.table, key }, [headerRow, ...rows]);
}

// El texto de scope/solution/benefits puede traer markdown (encabezados,
// tablas, **negritas**) — @react-pdf/renderer no interpreta HTML/markdown,
// solo Text/View plano, así que no se puede usar react-markdown aquí (ver
// cabecera del archivo: este worker corre fuera del bundler de Next a
// propósito). Parser liviano en el mismo espíritu que parseBullets: separa
// por línea en blanco, y reconoce encabezados, tablas GFM y reglas
// horizontales en vez de dejar "#"/"|"/"---" literales.
function renderRichText(raw) {
  const blocks = raw
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  const elements = [];
  blocks.forEach((block, i) => {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);

    if (lines.length >= 2 && lines[0].includes("|") && isTableSeparatorLine(lines[1])) {
      elements.push(renderTable(lines, `${i}-table`));
      return;
    }

    if (lines.length === 1 && /^(-{3,}|\*{3,}|_{3,})$/.test(lines[0])) {
      elements.push(h(View, { style: styles.hr, key: `${i}-hr` }));
      return;
    }

    const headingMatch = lines[0].match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
      elements.push(h(Text, { style: styles.blockHeading, key: `${i}-h` }, renderInline(headingMatch[1].trim())));
      const rest = lines.slice(1).join("\n").trim();
      if (rest) elements.push(h(Text, { style: styles.paragraph, key: `${i}-b` }, renderInline(rest)));
    } else {
      elements.push(h(Text, { style: styles.paragraph, key: `${i}` }, renderInline(block)));
    }
  });
  return elements;
}

function CoverMeta({ label, value }) {
  return h(View, { style: styles.coverMetaCol }, [
    h(Text, { style: styles.coverMetaLabel, key: "l" }, label),
    h(Text, { style: styles.coverMetaValue, key: "v" }, value),
  ]);
}

function Section({ label, children }) {
  return h(View, { style: styles.section }, [
    h(View, { style: styles.sectionLabelRow, key: "head" }, [
      h(View, { style: styles.sectionLabelBar, key: "bar" }),
      h(Text, { style: styles.sectionLabel, key: "label" }, label),
    ]),
    children,
  ]);
}

function ProposalDocument({ proposal }) {
  const dateStr = new Date(proposal.createdAt).toLocaleDateString("es-MX", {
    day: "2-digit", month: "long", year: "numeric",
  });
  const deliverableItems = proposal.deliverables ? parseBullets(proposal.deliverables) : [];
  const benefitItems = proposal.benefits ? parseBullets(proposal.benefits) : [];
  const benefitParagraph = proposal.benefits && benefitItems.length === 0 ? proposal.benefits : null;

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
      h(Text, { style: styles.coverEyebrow, key: "eyebrow" }, "PROPUESTA COMERCIAL"),
      h(Text, { style: styles.coverTitle, key: "title" }, proposal.title),
      h(View, { style: styles.coverMetaRow, key: "meta" }, [
        h(CoverMeta, { label: "Cliente", value: proposal.clientName, key: "m1" }),
        h(CoverMeta, { label: "Fecha", value: dateStr, key: "m2" }),
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

  const sections = [];

  sections.push(h(Section, { label: "Resumen ejecutivo", key: "sec-scope" },
    renderRichText(proposal.scope)));

  if (proposal.solution) {
    sections.push(h(Section, { label: "Solución propuesta", key: "sec-solution" },
      renderRichText(proposal.solution)));
  }

  if (deliverableItems.length > 0) {
    sections.push(h(Section, { label: "Alcance y entregables", key: "sec-deliverables" },
      h(View, { style: styles.checklist, wrap: false },
        deliverableItems.map((item, i) =>
          h(View, { style: styles.checklistItem, key: i }, [
            h(View, { style: styles.checklistDot, key: "dot" }),
            h(Text, { style: styles.checklistText, key: "text" }, item),
          ])))));
  }

  if (benefitItems.length > 0) {
    sections.push(h(Section, { label: "Beneficios", key: "sec-benefits" },
      h(View, { style: styles.benefitGrid },
        benefitItems.map((item, i) =>
          h(View, { style: styles.benefitBlock, wrap: false, key: i }, [
            h(View, { style: styles.benefitBadge, key: "badge" },
              h(Text, { style: styles.benefitBadgeText }, String(i + 1).padStart(2, "0"))),
            h(Text, { style: styles.benefitText, key: "text" }, item),
          ])))));
  } else if (benefitParagraph) {
    sections.push(h(Section, { label: "Beneficios", key: "sec-benefits-p" },
      renderRichText(benefitParagraph)));
  }

  if (proposal.budget || proposal.timeline) {
    sections.push(h(View, { style: styles.investRow, wrap: false, key: "invest" }, [
      proposal.budget && h(View, { style: styles.investCard, key: "budget" }, [
        h(View, { style: styles.investAccent, key: "accent" }),
        h(Text, { style: styles.investLabel, key: "label" }, "Inversión"),
        h(Text, { style: styles.investValue, key: "value" }, proposal.budget),
      ]),
      proposal.timeline && h(View, { style: styles.investCard, key: "timeline" }, [
        h(View, { style: styles.investAccent, key: "accent" }),
        h(Text, { style: styles.investLabel, key: "label" }, "Tiempo estimado"),
        h(Text, { style: styles.investValue, key: "value" }, proposal.timeline),
      ]),
    ].filter(Boolean)));
  }

  if (proposal.status === "aceptada") {
    sections.push(h(View, { style: styles.acceptedBanner, wrap: false, key: "accepted" },
      h(Text, { style: styles.acceptedText },
        `Propuesta aceptada${proposal.acceptedAt ? ` el ${new Date(proposal.acceptedAt).toLocaleDateString("es-MX")}` : ""}`)));
  }

  sections.push(h(Section, { label: "Fases del proyecto", key: "sec-phases" },
    h(View, { style: styles.phaseList },
      PHASES.map((phase, i) =>
        h(View, { style: styles.phaseRow, wrap: false, key: phase.n }, [
          h(View, { style: styles.phaseNumberCol, key: "col" }, [
            h(View, { style: styles.phaseNumberCircle, key: "circle" },
              h(Text, { style: styles.phaseNumberText }, phase.n)),
            i < PHASES.length - 1 && h(View, { style: styles.phaseConnector, key: "connector" }),
          ].filter(Boolean)),
          h(View, { style: styles.phaseTextCol, key: "text" }, [
            h(Text, { style: styles.phaseLabel, key: "label" }, phase.label),
            h(Text, { style: styles.phaseDesc, key: "desc" }, phase.desc),
          ]),
        ])))));

  sections.push(h(Section, { label: "Condiciones comerciales", key: "sec-terms" },
    h(View, { style: styles.termsCard },
      TERMS.map((term) =>
        h(View, { style: styles.termRow, wrap: false, key: term.label }, [
          h(Text, { style: styles.termLabel, key: "label" }, term.label),
          h(Text, { style: styles.termValue, key: "value" }, term.value),
        ])))));

  sections.push(h(View, { style: styles.closing, wrap: false, key: "closing" }, [
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

  section: { marginBottom: 22 },
  sectionLabelRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  sectionLabelBar: { width: 3, height: 11, backgroundColor: COLOR.primary, borderRadius: 1.5 },
  sectionLabel: {
    fontSize: 9, fontWeight: 700, color: COLOR.primary, letterSpacing: 1.5, textTransform: "uppercase",
  },
  paragraph: { fontSize: 10.5, lineHeight: 1.6, color: COLOR.body, marginBottom: 8 },
  blockHeading: { fontSize: 11.5, fontWeight: 700, color: COLOR.ink, marginTop: 4, marginBottom: 5 },
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

  checklist: { display: "flex", flexDirection: "column", gap: 8 },
  checklistItem: { flexDirection: "row", alignItems: "flex-start", gap: 9 },
  checklistDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLOR.primary, marginTop: 3.5 },
  checklistText: { fontSize: 10.5, lineHeight: 1.5, color: COLOR.body, flex: 1 },

  benefitGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  benefitBlock: {
    width: "48%", flexDirection: "row", gap: 10, alignItems: "flex-start",
    backgroundColor: COLOR.cardBg, borderWidth: 0.75, borderColor: COLOR.border,
    borderRadius: 8, padding: 12,
  },
  benefitBadge: {
    width: 20, height: 20, borderRadius: 5, backgroundColor: COLOR.primaryDim,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  benefitBadgeText: { fontSize: 7.5, fontWeight: 700, color: COLOR.primary },
  benefitText: { fontSize: 9.5, lineHeight: 1.45, color: COLOR.body, flex: 1 },

  investRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
  investCard: {
    flex: 1, borderRadius: 10, borderWidth: 0.75, borderColor: COLOR.border,
    backgroundColor: COLOR.ink, padding: 16, position: "relative", overflow: "hidden",
  },
  investAccent: {
    position: "absolute", top: 0, left: 0, right: 0, height: 3, backgroundColor: COLOR.primary,
  },
  investLabel: {
    fontSize: 8, fontWeight: 700, color: "#8B93A7", letterSpacing: 1.2,
    textTransform: "uppercase", marginBottom: 8,
  },
  investValue: { fontSize: 17, fontWeight: 800, color: COLOR.white },

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
  phaseLabel: { fontSize: 10.5, fontWeight: 700, color: COLOR.ink, marginBottom: 3 },
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
