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

const h = React.createElement;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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

/** Mismo criterio que parseBullets en render-proposal.mjs: separa líneas que
 * empiezan con -/•/* como lista; si no hay ninguna, se deja como párrafo. */
function parseBullets(raw) {
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  const bulletLines = lines.filter((l) => /^[-•*]\s+/.test(l));
  if (bulletLines.length === 0) return [];
  return lines.map((l) => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
}

function ClauseBody({ body }) {
  const bullets = parseBullets(body);
  if (bullets.length === 0) {
    return h(Text, { style: styles.clauseBody }, body);
  }
  return h(View, { style: styles.bulletList },
    bullets.map((item, i) =>
      h(View, { style: styles.bulletRow, key: i }, [
        h(Text, { style: styles.bulletDash, key: "dash" }, "–"),
        h(Text, { style: styles.bulletText, key: "text" }, item),
      ])));
}

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

      ...contract.sections.map((section, i) =>
        h(View, { style: styles.clause, key: section.key ?? i, wrap: false }, [
          h(Text, { style: styles.clauseTitle, key: "title" }, [
            `${ordinalFor(i)}. `,
            h(Text, { style: styles.clauseTitleCaps, key: "caps" }, section.title.toUpperCase()),
            ".",
          ]),
          h(ClauseBody, { body: section.body, key: "body" }),
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
  clauseBody: { fontSize: 10.5, lineHeight: 1.55, color: COLOR.body, textAlign: "justify" },

  bulletList: { display: "flex", flexDirection: "column", gap: 3, marginTop: 2 },
  bulletRow: { flexDirection: "row", gap: 6 },
  bulletDash: { fontSize: 10.5, color: COLOR.body },
  bulletText: { fontSize: 10.5, lineHeight: 1.5, color: COLOR.body, flex: 1 },

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
