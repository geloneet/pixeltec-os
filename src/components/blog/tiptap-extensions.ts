/**
 * B-PR8 — Extensiones Tiptap compartidas entre el editor visual
 * (`rich-markdown-editor.tsx`), el roundtrip headless (`tiptap-roundtrip.ts`)
 * y el script de verificación de corpus (`scripts/blog/verify-roundtrip.ts`).
 *
 * DEBEN ser exactamente las mismas en los tres sitios: la guardia
 * `markdownRoundtripSafe` solo es válida si el serializador que verifica es
 * el mismo que luego edita.
 *
 * Decisión D1 del plan: Tiptap v2 (MIT) + tiptap-markdown; el Markdown sigue
 * siendo el almacenamiento canónico.
 */
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { Markdown } from "tiptap-markdown";
import type { AnyExtension } from "@tiptap/core";

export function createBlogEditorExtensions(): AnyExtension[] {
  return [
    StarterKit.configure({
      // El cuerpo empieza en H2: el H1 es el título del post (campo aparte).
      // Un post legacy con `#` en el cuerpo NO roundtripea → la guardia lo
      // abre en modo Markdown (sin pérdida), que es el comportamiento buscado.
      heading: { levels: [2, 3] },
    }),
    Link.configure({ openOnClick: false }),
    Image,
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    Markdown.configure({
      // Sin HTML: los posts con HTML crudo van a modo Markdown por la guardia;
      // el editor visual jamás debe emitir (ni tragarse en silencio) HTML.
      html: false,
      tightLists: true,
      bulletListMarker: "-",
      linkify: false,
      breaks: false,
      transformPastedText: true,
      transformCopiedText: false,
    }),
  ];
}
