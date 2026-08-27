// Worker de render del PDF de COTIZACIÓN (WO-2026-00101) — proceso Node plano,
// invocado vía child_process desde src/lib/quotes/pdf.ts.
//
// Mismo patrón (y mismo motivo) que render-proposal.mjs / render-contract.mjs:
// cualquier archivo que el bundler de Next compile para el servidor resuelve
// "react" contra la copia vendorizada de Next, y el reconciler de
// @react-pdf/renderer no reconoce esos elementos → React error #31. La única
// forma confirmada de evitarlo es renderizar en un proceso de Node ajeno al
// bundler. Por eso este archivo es .mjs plano, sin JSX, y solo se invoca por
// ruta de archivo.
//
// Uso: node render-quote.mjs <inputJsonPath> <outputPdfPath>
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { Document, Page, Text, View, Image, Font, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

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
  ink: "#0A0D14",
  body: "#2B303B",
  muted: "#6B7280",
  rule: "#E5E7EB",
  band: "#F6F7F9",
  brand: "#1F6FEB",
};

const styles = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 56, paddingHorizontal: 44, fontFamily: "Poppins", fontSize: 9.5, color: COLOR.body },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 26 },
  logo: { width: 34, height: 34 },
  brandName: { fontSize: 13, fontWeight: 700, color: COLOR.ink, letterSpacing: -0.3 },
  brandLine: { fontSize: 8, color: COLOR.muted, marginTop: 2 },
  docLabel: { fontSize: 8, color: COLOR.muted, letterSpacing: 1.4, textAlign: "right" },
  folio: { fontSize: 14, fontWeight: 700, color: COLOR.ink, textAlign: "right", marginTop: 2 },
  metaRight: { fontSize: 8, color: COLOR.muted, textAlign: "right", marginTop: 3 },

  title: { fontSize: 17, fontWeight: 700, color: COLOR.ink, marginBottom: 4 },
  forLine: { fontSize: 10, color: COLOR.body, marginBottom: 22 },
  forLabel: { color: COLOR.muted },

  thead: { flexDirection: "row", backgroundColor: COLOR.band, paddingVertical: 7, paddingHorizontal: 8, borderRadius: 3 },
  th: { fontSize: 8, fontWeight: 700, color: COLOR.ink, letterSpacing: 0.4 },
  row: { flexDirection: "row", paddingVertical: 8, paddingHorizontal: 8, borderBottomWidth: 0.6, borderBottomColor: COLOR.rule },
  cDesc: { flex: 1, paddingRight: 10 },
  cQty: { width: 52, textAlign: "right" },
  cUnit: { width: 82, textAlign: "right" },
  cTotal: { width: 90, textAlign: "right" },
  cellRight: { textAlign: "right" },

  totals: { marginTop: 16, alignSelf: "flex-end", width: 236 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  totalLabel: { color: COLOR.muted },
  grand: { flexDirection: "row", justifyContent: "space-between", marginTop: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLOR.ink },
  grandLabel: { fontSize: 11, fontWeight: 700, color: COLOR.ink },
  grandValue: { fontSize: 13, fontWeight: 700, color: COLOR.ink },

  block: { marginTop: 26 },
  blockTitle: { fontSize: 8, fontWeight: 700, color: COLOR.muted, letterSpacing: 1.2, marginBottom: 5 },
  blockBody: { fontSize: 9, lineHeight: 1.55, color: COLOR.body },

  footer: { position: "absolute", left: 44, right: 44, bottom: 26, borderTopWidth: 0.6, borderTopColor: COLOR.rule, paddingTop: 8, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 7.5, color: COLOR.muted },
});

function QuoteDocument({ q }) {
  const rows = q.items.map((item, i) =>
    h(View, { key: `r${i}`, style: styles.row, wrap: false }, [
      h(Text, { key: "d", style: styles.cDesc }, item.description),
      h(Text, { key: "q", style: [styles.cQty, styles.cellRight] }, item.quantity),
      h(Text, { key: "u", style: [styles.cUnit, styles.cellRight] }, item.unitPrice),
      h(Text, { key: "t", style: [styles.cTotal, styles.cellRight] }, item.lineTotal),
    ]),
  );

  const totalRows = [
    h(View, { key: "sub", style: styles.totalRow }, [
      h(Text, { key: "l", style: styles.totalLabel }, "Subtotal"),
      h(Text, { key: "v" }, q.subtotal),
    ]),
  ];
  if (q.taxEnabled) {
    totalRows.push(
      h(View, { key: "iva", style: styles.totalRow }, [
        h(Text, { key: "l", style: styles.totalLabel }, "IVA 16%"),
        h(Text, { key: "v" }, q.tax),
      ]),
    );
  }

  return h(
    Document,
    { title: `${q.folio} — ${q.title}`, author: "PixelTEC" },
    h(Page, { size: "LETTER", style: styles.page }, [
      h(View, { key: "head", style: styles.header }, [
        h(View, { key: "brand", style: { flexDirection: "row", alignItems: "center", gap: 9 } }, [
          h(Image, { key: "logo", src: LOGO_PATH, style: styles.logo }),
          h(View, { key: "names" }, [
            h(Text, { key: "n", style: styles.brandName }, "PixelTEC"),
            h(Text, { key: "l", style: styles.brandLine }, "pixeltec.mx"),
          ]),
        ]),
        h(View, { key: "meta" }, [
          h(Text, { key: "lab", style: styles.docLabel }, "PROPUESTA"),
          h(Text, { key: "fol", style: styles.folio }, q.folio),
          h(Text, { key: "date", style: styles.metaRight }, `Fecha: ${q.date}`),
          q.validUntil ? h(Text, { key: "vig", style: styles.metaRight }, `Vigencia: ${q.validUntil}`) : null,
        ]),
      ]),

      h(Text, { key: "title", style: styles.title }, q.title),
      h(Text, { key: "for", style: styles.forLine }, [
        h(Text, { key: "l", style: styles.forLabel }, "Para: "),
        q.clientName,
      ]),

      q.problem ? h(View, { key: "problem", style: styles.block }, [
        h(Text, { key: "t", style: styles.blockTitle }, "EL PROBLEMA"),
        h(Text, { key: "b", style: styles.blockBody }, q.problem),
      ]) : null,
      q.solution ? h(View, { key: "solution", style: styles.block }, [
        h(Text, { key: "t", style: styles.blockTitle }, "SOLUCIÓN PROPUESTA"),
        h(Text, { key: "b", style: styles.blockBody }, q.solution),
      ]) : null,
      q.scopeIncluded ? h(View, { key: "scope", style: styles.block }, [
        h(Text, { key: "t", style: styles.blockTitle }, "ALCANCE INCLUIDO"),
        h(Text, { key: "b", style: styles.blockBody }, q.scopeIncluded),
      ]) : null,

      h(Text, { key: "invLabel", style: [styles.blockTitle, { marginTop: 26, marginBottom: 6 }] }, "INVERSIÓN"),
      h(View, { key: "thead", style: styles.thead }, [
        h(Text, { key: "d", style: [styles.th, styles.cDesc] }, "CONCEPTO"),
        h(Text, { key: "q", style: [styles.th, styles.cQty, styles.cellRight] }, "CANT."),
        h(Text, { key: "u", style: [styles.th, styles.cUnit, styles.cellRight] }, "P. UNITARIO"),
        h(Text, { key: "t", style: [styles.th, styles.cTotal, styles.cellRight] }, "IMPORTE"),
      ]),
      h(View, { key: "rows" }, rows),

      h(View, { key: "totals", style: styles.totals }, [
        ...totalRows,
        h(View, { key: "grand", style: styles.grand }, [
          h(Text, { key: "l", style: styles.grandLabel }, "Total"),
          h(Text, { key: "v", style: styles.grandValue }, q.total),
        ]),
      ]),

      q.estimatedDelivery ? h(View, { key: "time", style: styles.block }, [
        h(Text, { key: "t", style: styles.blockTitle }, "TIEMPO ESTIMADO"),
        h(Text, { key: "b", style: styles.blockBody }, q.estimatedDelivery),
      ]) : null,
      q.paymentSummary ? h(View, { key: "pay", style: styles.block }, [
        h(Text, { key: "t", style: styles.blockTitle }, "FORMA DE PAGO"),
        h(Text, { key: "b", style: styles.blockBody }, q.paymentSummary),
      ]) : null,
      q.exclusions ? h(View, { key: "excl", style: styles.block }, [
        h(Text, { key: "t", style: styles.blockTitle }, "FUERA DE ALCANCE"),
        h(Text, { key: "b", style: styles.blockBody }, q.exclusions),
      ]) : null,
      q.notes
        ? h(View, { key: "notes", style: styles.block }, [
            h(Text, { key: "t", style: styles.blockTitle }, "NOTAS Y CONDICIONES"),
            h(Text, { key: "b", style: styles.blockBody }, q.notes),
          ])
        : null,
      h(View, { key: "next", style: [styles.block, { backgroundColor: COLOR.band, borderRadius: 4, padding: 12 }] }, [
        h(Text, { key: "t", style: styles.blockTitle }, "SIGUIENTE PASO"),
        h(Text, { key: "b", style: styles.blockBody }, "Aceptar la propuesta y realizar el anticipo correspondiente."),
      ]),

      h(View, { key: "footer", style: styles.footer, fixed: true }, [
        h(Text, { key: "l", style: styles.footerText }, `${q.folio} · PixelTEC`),
        h(
          Text,
          {
            key: "r",
            style: styles.footerText,
            render: ({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`,
          },
        ),
      ]),
    ]),
  );
}

async function main() {
  const [, , inputJsonPath, outputPdfPath] = process.argv;
  if (!inputJsonPath || !outputPdfPath) {
    console.error("Uso: node render-quote.mjs <inputJsonPath> <outputPdfPath>");
    process.exit(1);
  }
  const q = JSON.parse(readFileSync(inputJsonPath, "utf-8"));
  const pdf = await renderToBuffer(h(QuoteDocument, { q }));
  writeFileSync(outputPdfPath, pdf);
}

main().catch((err) => {
  console.error(err?.stack ?? String(err));
  process.exit(1);
});
