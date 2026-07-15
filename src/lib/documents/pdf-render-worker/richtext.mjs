// Render compartido de markdown liviano para los workers de PDF (propuestas y
// contratos). @react-pdf/renderer no interpreta markdown, así que se arma a
// mano con Text/View que FLUYEN (sin wrap:false en contenedores multi-item)
// para que paginen en vez de encimarse.
//
// Los estilos se inyectan porque cada documento tiene identidad propia
// (propuesta = "premium tech", contrato = legal formal). Claves esperadas:
//   paragraph, blockHeading, blockHeadingLg, hr,
//   listItem, listNum, listDotWrap, listText,
//   bold, italic, code,
//   table, tableHeaderRow, tableRow, tableCellHead, tableCell,
//   tableCellHeadText, tableCellText
import React from "react";
import { View, Text } from "@react-pdf/renderer";

const h = React.createElement;

function isTableSeparatorLine(line) {
  return /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?$/.test(line.trim());
}

function parseTableRow(line) {
  let l = line.trim();
  if (l.startsWith("|")) l = l.slice(1);
  if (l.endsWith("|")) l = l.slice(0, -1);
  return l.split("|").map((c) => c.trim());
}

export function createRichText(styles) {
  // Convierte "**negritas**"/"*cursivas*"/`código` en spans de Text anidados —
  // sin esto los marcadores salen literales. react-pdf sí soporta <Text>
  // anidado con su propio estilo como forma estándar de texto con estilos mixtos.
  function renderInline(text) {
    // Sin marcadores → devuelve el string tal cual (ruta rápida). OJO: no usar
    // `parts.length <= 1` para esto — un texto que ES un solo span (ej. una
    // celda que es toda "**negrita**") también da un solo part y saldría con
    // los marcadores crudos.
    if (!text.includes("*") && !text.includes("`")) return text;
    const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g).filter((p) => p !== "");
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return h(Text, { key: i, style: styles.bold }, part.slice(2, -2));
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return h(Text, { key: i, style: styles.code }, part.slice(1, -1));
      }
      if (part.startsWith("*") && part.endsWith("*")) {
        return h(Text, { key: i, style: styles.italic }, part.slice(1, -1));
      }
      return part;
    });
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

  // Renderiza markdown liviano que la IA genera con estructura rica:
  // encabezados, tablas GFM (incluso pegadas a un encabezado sin línea en
  // blanco), listas ordenadas/no ordenadas, reglas horizontales,
  // **negritas**/*cursivas* y párrafos. Se procesa LÍNEA POR LÍNEA (no bloque
  // por bloque) para que un `## título` seguido sin línea en blanco de una
  // tabla no rompa la detección.
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

  return { renderRichText, renderInline };
}
