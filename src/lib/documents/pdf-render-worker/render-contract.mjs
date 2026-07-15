// Worker de render de PDF de contratos — mismo patrón (y mismo motivo) que
// render-proposal.mjs: cualquier archivo que el bundler de Next.js compile
// para el servidor resuelve "react" contra su copia vendorizada interna, que
// el reconciler de @react-pdf/renderer no reconoce (React error #31). Este
// archivo es JS plano (sin JSX/TypeScript), usa React.createElement (h)
// directamente, y solo se invoca vía child_process desde
// src/app/api/documents/contract-pdf/route.ts — nunca lo importa código que
// Next compile.
//
// Diseño: a diferencia de las propuestas (portada oscura, estética
// "premium tech"), el contrato imita un documento legal formal tradicional
// (ver docs/CONTRATO DE SERVICIOS - TRANSPORTES SANCHEZ JR.docx.pdf de
// referencia) — una sola página continua, encabezado Cliente/Fecha + logo,
// título centrado, párrafo de apertura, cláusulas numeradas con ordinales en
// español, bloque de firmas.
//
// Uso: node render-contract.mjs <inputJsonPath> <outputPdfPath>

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
  Font,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import { createRichText } from "./richtext.mjs";

const h = React.createElement;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "../../../..");
const FONTS_DIR = path.join(PROJECT_ROOT, "src/lib/documents/fonts");
const LOGO_PATH = path.join(PROJECT_ROOT, "public", "ptlogox.png");

Font.register({
  family: "Poppins",
  fonts: [
    { src: path.join(FONTS_DIR, "Poppins-Regular.ttf"), fontWeight: 400 },
    // Itálica real: sin esta variante, un `*texto*` en markdown (fontStyle:italic)
    // no resuelve fuente y @react-pdf tira "Could not resolve font" → 500 en todo
    // el contrato. Mismo tropiezo ya documentado en render-proposal.mjs.
    { src: path.join(FONTS_DIR, "Poppins-Italic.ttf"), fontWeight: 400, fontStyle: "italic" },
    { src: path.join(FONTS_DIR, "Poppins-SemiBold.ttf"), fontWeight: 600 },
    { src: path.join(FONTS_DIR, "Poppins-Bold.ttf"), fontWeight: 700 },
    { src: path.join(FONTS_DIR, "Poppins-ExtraBold.ttf"), fontWeight: 800 },
  ],
});
Font.registerHyphenationCallback((word) => [word]);

const COLOR = {
  ink: "#111827",
  body: "#1F2937",
  muted: "#4B5563",
  faint: "#9CA3AF",
  border: "#D1D5DB",
};

const ORDINALS = [
  "PRIMERA", "SEGUNDA", "TERCERA", "CUARTA", "QUINTA", "SEXTA", "SÉPTIMA",
  "OCTAVA", "NOVENA", "DÉCIMA", "DÉCIMA PRIMERA", "DÉCIMA SEGUNDA",
  "DÉCIMA TERCERA", "DÉCIMA CUARTA", "DÉCIMA QUINTA", "DÉCIMA SEXTA",
  "DÉCIMA SÉPTIMA", "DÉCIMA OCTAVA", "DÉCIMA NOVENA", "VIGÉSIMA",
];
function ordinalFor(index) {
  return ORDINALS[index] ?? `CLÁUSULA ${index + 1}`;
}

const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
  "septiembre", "octubre", "noviembre", "diciembre",
];

// El cuerpo de una cláusula puede traer markdown completo (las cláusulas de
// Alcance/Entregables se copian de los docs generados por IA: encabezados,
// listas numeradas, tablas GFM, **negritas**) — se renderiza con el módulo
// compartido richtext.mjs (mismo que las propuestas), con estilos legales
// propios de este documento.

function ContractDocument({ contract }) {
  const date = new Date(contract.createdAt);
  const dateStrHeader = date.toLocaleDateString("es-MX", {
    day: "2-digit", month: "long", year: "numeric",
  });
  const day = date.getDate();
  const month = MONTHS_ES[date.getMonth()];
  const year = date.getFullYear();

  const signers = contract.signers ?? [];
  // Siempre 2 columnas: la primera para PixelTEC ("EL DESARROLLADOR"), la
  // segunda para el cliente ("EL CLIENTE") — si hay firmantes reales se usan
  // sus datos; si no, se dejan líneas en blanco con el rol genérico, sin
  // inventar nombres.
  const developerSigner = signers[0] ?? null;
  const clientSigner = signers[1] ?? null;

  return h(Document, { title: `${contract.title} — ${contract.clientName}` },
    h(Page, { size: "A4", style: styles.page }, [
      h(View, { style: styles.header, fixed: true, key: "header" }, [
        h(View, { key: "meta" }, [
          h(Text, { style: styles.headerLine, key: "cliente" }, [
            h(Text, { style: styles.headerLabel, key: "l" }, "Cliente: "),
            contract.clientName,
          ]),
          h(Text, { style: styles.headerLine, key: "fecha" }, [
            h(Text, { style: styles.headerLabel, key: "l" }, "Fecha: "),
            dateStrHeader,
          ]),
        ]),
        h(Image, { src: LOGO_PATH, style: styles.headerLogo, key: "logo" }),
      ]),
      h(View, { style: styles.headerDivider, fixed: true, key: "divider" }),

      h(Text, { style: styles.title, key: "title" }, contract.title.toUpperCase()),

      h(Text, { style: styles.opening, key: "opening" }, [
        `En la ciudad de Puerto Vallarta, Jalisco, a los ${day} días del mes de ${month} de ${year}, celebran el presente contrato: Por una parte, PixelTEC (en adelante "EL DESARROLLADOR"). Y por la otra, ${contract.clientName} (en adelante "EL CLIENTE"). Ambas partes se reconocen la capacidad legal para contratar y convienen sujetarse a las siguientes cláusulas:`,
      ]),

      // Sin wrap:false: una cláusula más alta que la página (Alcance y
      // Entregables llegan a varios miles de caracteres) debe PAGINAR —
      // con wrap:false @react-pdf la desborda encimándola sobre el resto.
      // minPresenceAhead evita que el título quede huérfano al pie de página.
      ...contract.sections.map((section, i) =>
        h(View, { style: styles.clause, key: section.key ?? i }, [
          h(Text, { style: styles.clauseTitle, key: "title", minPresenceAhead: 30 }, [
            `${ordinalFor(i)}. `,
            h(Text, { style: styles.clauseTitleCaps, key: "caps" }, section.title.toUpperCase()),
            ".",
          ]),
          ...renderRichText(section.body),
        ])),

      h(Text, { style: styles.closing, key: "closing" },
        "Leído el presente contrato y enteradas las partes de su contenido y alcance legal, lo firman de conformidad."),

      h(View, { style: styles.signRow, key: "signatures", wrap: false }, [
        h(SignatureBlock, { key: "dev", signer: developerSigner, fallbackRole: "EL DESARROLLADOR" }),
        h(SignatureBlock, { key: "client", signer: clientSigner, fallbackRole: "EL CLIENTE" }),
      ]),

      h(Text, {
        style: styles.pageFooter,
        fixed: true,
        key: "footer",
        render: ({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`,
      }),
    ]));
}

function SignatureBlock({ signer, fallbackRole }) {
  return h(View, { style: styles.signCol }, [
    h(View, { style: styles.signLine, key: "line" }),
    h(Text, { style: styles.signName, key: "name" }, signer?.name ?? " "),
    h(Text, { style: styles.signRole, key: "role" }, (signer?.role || fallbackRole).toUpperCase()),
    signer?.signedAt &&
      h(Text, { style: styles.signDate, key: "date" },
        `Firmado el ${new Date(signer.signedAt).toLocaleDateString("es-MX")}`),
  ].filter(Boolean));
}

const styles = StyleSheet.create({
  page: {
    fontFamily: "Poppins",
    backgroundColor: "#FFFFFF",
    color: COLOR.body,
    paddingTop: 78,
    paddingBottom: 56,
    paddingHorizontal: 60,
  },
  header: {
    position: "absolute", top: 40, left: 60, right: 60,
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
  },
  headerLine: { fontSize: 9.5, color: COLOR.body, marginBottom: 3 },
  headerLabel: { fontWeight: 700 },
  headerLogo: { width: 30, height: 32 },
  headerDivider: {
    position: "absolute", top: 76, left: 60, right: 60,
    borderBottomWidth: 0.75, borderBottomColor: COLOR.border,
  },

  title: {
    fontSize: 15, fontWeight: 700, color: COLOR.ink, textAlign: "center",
    marginBottom: 18, lineHeight: 1.3,
  },
  opening: { fontSize: 10.5, lineHeight: 1.6, color: COLOR.body, marginBottom: 16, textAlign: "justify" },

  clause: { marginBottom: 12 },
  clauseTitle: { fontSize: 10.5, fontWeight: 700, color: COLOR.ink, marginBottom: 4 },
  clauseTitleCaps: { fontWeight: 700 },

  // Estilos que consume richtext.mjs (ver contrato de claves en ese módulo) —
  // misma tipografía del cuerpo legal, sin el azul de las propuestas.
  paragraph: { fontSize: 10.5, lineHeight: 1.55, color: COLOR.body, textAlign: "justify", marginBottom: 6 },
  blockHeadingLg: { fontSize: 11, fontWeight: 700, color: COLOR.ink, marginTop: 8, marginBottom: 4 },
  blockHeading: { fontSize: 10.5, fontWeight: 600, color: COLOR.ink, marginTop: 6, marginBottom: 3 },
  listItem: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginBottom: 3 },
  listDotWrap: { fontSize: 10.5, lineHeight: 1.5, color: COLOR.body, width: 10 },
  listNum: { fontSize: 10.5, lineHeight: 1.5, color: COLOR.body, fontWeight: 600, width: 16 },
  listText: { fontSize: 10.5, lineHeight: 1.5, color: COLOR.body, flex: 1 },
  bold: { fontWeight: 700, color: COLOR.ink },
  italic: { fontStyle: "italic" },
  code: { fontWeight: 600, color: COLOR.muted },
  hr: { height: 0.75, backgroundColor: COLOR.border, marginVertical: 8 },
  table: {
    display: "flex", flexDirection: "column", marginBottom: 8,
    borderWidth: 0.75, borderColor: COLOR.border,
  },
  tableHeaderRow: { flexDirection: "row", backgroundColor: "#F3F4F6" },
  tableRow: { flexDirection: "row", borderTopWidth: 0.75, borderTopColor: COLOR.border },
  tableCellHead: { flex: 1, padding: 5, borderRightWidth: 0.75, borderRightColor: COLOR.border },
  tableCell: { flex: 1, padding: 5, borderRightWidth: 0.75, borderRightColor: COLOR.border },
  tableCellHeadText: { fontSize: 8.5, fontWeight: 700, color: COLOR.ink },
  tableCellText: { fontSize: 8.5, lineHeight: 1.4, color: COLOR.body },

  closing: { fontSize: 10.5, lineHeight: 1.6, color: COLOR.body, marginTop: 8, marginBottom: 48 },

  signRow: { flexDirection: "row", justifyContent: "space-between", gap: 40 },
  signCol: { flex: 1, alignItems: "center" },
  signLine: { width: "100%", borderBottomWidth: 0.75, borderBottomColor: COLOR.ink, marginBottom: 6 },
  signName: { fontSize: 10, fontWeight: 700, color: COLOR.ink, textAlign: "center" },
  signRole: { fontSize: 9, color: COLOR.muted, textAlign: "center", marginTop: 2 },
  signDate: { fontSize: 8, color: COLOR.faint, textAlign: "center", marginTop: 3 },

  pageFooter: {
    position: "absolute", bottom: 24, left: 60, right: 60,
    textAlign: "center", fontSize: 8, color: COLOR.faint,
  },
});

const { renderRichText } = createRichText(styles);

async function main() {
  const [, , inputJsonPath, outputPdfPath] = process.argv;
  if (!inputJsonPath || !outputPdfPath) {
    console.error("Uso: node render-contract.mjs <inputJsonPath> <outputPdfPath>");
    process.exit(1);
  }
  const contract = JSON.parse(readFileSync(inputJsonPath, "utf-8"));
  const pdf = await renderToBuffer(h(ContractDocument, { contract }));
  writeFileSync(outputPdfPath, pdf);
}

main().catch((err) => {
  console.error(err?.stack ?? String(err));
  process.exit(1);
});
