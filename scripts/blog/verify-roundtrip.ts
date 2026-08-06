/**
 * B-PR8 — Verificación de corpus REAL del roundtrip Markdown (SOLO LECTURA).
 *
 * Corre `markdownRoundtripSafe` (guardia del editor visual) con el
 * serializador REAL de Tiptap sobre TODOS los `blog_posts` y reporta
 * id, slug, safe y reason. No escribe nada en la base.
 *
 * Uso (en el VPS, donde existe DATABASE_URL):
 *   cd /ruta/del/proyecto
 *   DATABASE_URL="postgres://…" npx tsx scripts/blog/verify-roundtrip.ts
 *
 * Salida: una línea por post (`SAFE`/`UNSAFE  motivo`) + resumen. Los posts
 * UNSAFE no son un error: simplemente abrirán en modo Markdown (fallback).
 */

import { JSDOM } from "jsdom";

// Tiptap necesita un DOM: se inyecta jsdom ANTES de importar el serializador.
const dom = new JSDOM("<!doctype html><html><body></body></html>");
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", {
  value: dom.window.navigator,
  configurable: true,
});
g.MutationObserver = dom.window.MutationObserver;
g.Element = dom.window.Element;
g.HTMLElement = dom.window.HTMLElement;
g.Node = dom.window.Node;
g.Document = dom.window.Document;
g.DOMParser = dom.window.DOMParser;
g.getComputedStyle = dom.window.getComputedStyle;
g.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0);
g.cancelAnimationFrame = (id: number) => clearTimeout(id);

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      "DATABASE_URL no está definida — este script es de solo lectura y " +
        "debe correrse donde exista la base (VPS).",
    );
    process.exit(1);
  }

  // Imports dinámicos: después de inyectar el DOM.
  const { default: postgres } = await import("postgres");
  const { serializeThroughTiptap } = await import(
    "../../src/components/blog/tiptap-roundtrip"
  );
  const { markdownRoundtripSafe } = await import(
    "../../src/lib/blog/markdown-roundtrip"
  );

  const sql = postgres(url, { max: 1 });
  try {
    const rows = await sql<{ id: string; slug: string; status: string; body: string }[]>`
      SELECT id, slug, status, body
      FROM blog_posts
      ORDER BY created_at
    `;

    let safeCount = 0;
    let unsafeCount = 0;
    for (const row of rows) {
      const verdict = markdownRoundtripSafe(row.body, serializeThroughTiptap);
      if (verdict.safe) {
        safeCount++;
        console.log(`SAFE    ${row.id}  ${row.slug} (${row.status})`);
      } else {
        unsafeCount++;
        console.log(
          `UNSAFE  ${row.id}  ${row.slug} (${row.status}) — ${verdict.reason}`,
        );
      }
    }

    console.log("");
    console.log(
      `Total: ${rows.length} posts — ${safeCount} abren en editor visual, ` +
        `${unsafeCount} abren en modo Markdown (fallback, sin pérdida).`,
    );
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error("verify-roundtrip falló:", error);
  process.exit(1);
});
