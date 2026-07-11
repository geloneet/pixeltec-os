// Worker de render de PDF de facturas — mismo patrón (y mismo motivo) que
// render-contract.mjs: cualquier archivo que el bundler de Next.js compile
// para el servidor resuelve "react" contra su copia vendorizada interna, que
// el reconciler de @react-pdf/renderer no reconoce (React error #31). Este
// archivo es JS plano (sin JSX/TypeScript), usa React.createElement (h)
// directamente, y solo se invoca vía child_process desde
// src/lib/documents/invoice-pdf-render.ts — nunca lo importa código que
// Next compile.
//
// Documento formal: encabezado Cliente/Fecha + logo, título FACTURA + folio,
// tabla de conceptos, totales con IVA — misma identidad visual (Poppins,
// paleta COLOR) que contratos y propuestas.
//
// Uso: node render-invoice.mjs <inputJsonPath> <outputPdfPath>

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

const styles = StyleSheet.create({
  page: { padding: 48, fontFamily: "Poppins", fontSize: 10, color: COLOR.body },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  headerLogo: { width: 90, height: 28, objectFit: "contain" },
  headerLine: { fontSize: 9, color: COLOR.muted, marginBottom: 2 },
  headerLabel: { fontWeight: 600, color: COLOR.ink },
  headerDivider: { borderBottomWidth: 1, borderBottomColor: COLOR.border, marginBottom: 20 },
  title: { fontSize: 18, fontWeight: 700, color: COLOR.ink, marginBottom: 4 },
  folio: { fontSize: 11, color: COLOR.muted, marginBottom: 20 },
  table: { marginTop: 8, marginBottom: 20 },
  tableHeaderRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: COLOR.ink, paddingBottom: 6, marginBottom: 6 },
  tableRow: { flexDirection: "row", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: COLOR.border },
  colDesc: { flex: 3, fontSize: 9 },
  colQty: { flex: 1, fontSize: 9, textAlign: "center" },
  colPrice: { flex: 1, fontSize: 9, textAlign: "right" },
  colSubtotal: { flex: 1, fontSize: 9, textAlign: "right" },
  tableHeaderText: { fontWeight: 700, fontSize: 9, color: COLOR.ink },
  totals: { alignSelf: "flex-end", width: 220, marginTop: 8 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  totalLabel: { fontSize: 9, color: COLOR.muted },
  totalValue: { fontSize: 9, color: COLOR.ink },
  grandTotalRow: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: COLOR.ink, paddingTop: 6, marginTop: 4 },
  grandTotalLabel: { fontSize: 11, fontWeight: 700, color: COLOR.ink },
  grandTotalValue: { fontSize: 11, fontWeight: 700, color: COLOR.ink },
});

function money(n) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

function InvoiceDocument({ invoice, clientName }) {
  const dateStr = new Date(invoice.issueDate).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
  return h(Document, { title: `${invoice.number} — ${clientName}` },
    h(Page, { size: "A4", style: styles.page }, [
      h(View, { style: styles.header, key: "header" }, [
        h(View, { key: "meta" }, [
          h(Text, { style: styles.headerLine, key: "cliente" }, [h(Text, { style: styles.headerLabel, key: "l" }, "Cliente: "), clientName]),
          h(Text, { style: styles.headerLine, key: "fecha" }, [h(Text, { style: styles.headerLabel, key: "l" }, "Fecha: "), dateStr]),
        ]),
        h(Image, { src: LOGO_PATH, style: styles.headerLogo, key: "logo" }),
      ]),
      h(View, { style: styles.headerDivider, key: "divider" }),
      h(Text, { style: styles.title, key: "title" }, "FACTURA"),
      h(Text, { style: styles.folio, key: "folio" }, invoice.number),
      h(View, { style: styles.table, key: "table" }, [
        h(View, { style: styles.tableHeaderRow, key: "thead" }, [
          h(Text, { style: [styles.colDesc, styles.tableHeaderText], key: "d" }, "Concepto"),
          h(Text, { style: [styles.colQty, styles.tableHeaderText], key: "q" }, "Cant."),
          h(Text, { style: [styles.colPrice, styles.tableHeaderText], key: "p" }, "P. Unitario"),
          h(Text, { style: [styles.colSubtotal, styles.tableHeaderText], key: "s" }, "Subtotal"),
        ]),
        ...invoice.items.map((it, i) =>
          h(View, { style: styles.tableRow, key: i }, [
            h(Text, { style: styles.colDesc, key: "d" }, it.description),
            h(Text, { style: styles.colQty, key: "q" }, String(it.qty)),
            h(Text, { style: styles.colPrice, key: "p" }, money(it.unitPrice)),
            h(Text, { style: styles.colSubtotal, key: "s" }, money(it.subtotal)),
          ])),
      ]),
      h(View, { style: styles.totals, key: "totals" }, [
        h(View, { style: styles.totalRow, key: "sub" }, [
          h(Text, { style: styles.totalLabel, key: "l" }, "Subtotal"),
          h(Text, { style: styles.totalValue, key: "v" }, money(invoice.subtotal)),
        ]),
        h(View, { style: styles.totalRow, key: "iva" }, [
          h(Text, { style: styles.totalLabel, key: "l" }, `IVA (${(invoice.ivaRate * 100).toFixed(0)}%)`),
          h(Text, { style: styles.totalValue, key: "v" }, money(invoice.ivaAmount)),
        ]),
        h(View, { style: styles.grandTotalRow, key: "total" }, [
          h(Text, { style: styles.grandTotalLabel, key: "l" }, "Total"),
          h(Text, { style: styles.grandTotalValue, key: "v" }, money(invoice.total)),
        ]),
      ]),
    ]));
}

async function main() {
  const [, , inputPath, outputPath] = process.argv;
  if (!inputPath || !outputPath) {
    console.error("Uso: node render-invoice.mjs <inputJsonPath> <outputPdfPath>");
    process.exit(1);
  }
  const input = JSON.parse(readFileSync(inputPath, "utf-8"));
  const buffer = await renderToBuffer(h(InvoiceDocument, { invoice: input, clientName: input.clientName }));
  writeFileSync(outputPath, buffer);
}

main().catch((err) => {
  console.error(err?.stack ?? String(err));
  process.exit(1);
});
