/**
 * B-PR8 — Roundtrip headless con el serializador REAL del editor visual.
 *
 * `serializeThroughTiptap(md)` hace el viaje completo Markdown → ProseMirror →
 * Markdown con exactamente las mismas extensiones que usa el editor. Es la
 * `serializeFn` que se inyecta en `markdownRoundtripSafe`.
 *
 * Requiere DOM (Tiptap crea un elemento aunque no se monte): en el navegador
 * funciona tal cual; en node (tests / script de corpus) hace falta jsdom.
 * Por eso este módulo se importa SIEMPRE de forma dinámica desde el cliente
 * (`await import(...)`) y nunca desde código que corra en SSR.
 */
import { Editor } from "@tiptap/core";
import { createBlogEditorExtensions } from "./tiptap-extensions";

interface MarkdownStorage {
  getMarkdown(): string;
}

/** Markdown → ProseMirror → Markdown con las extensiones reales del editor. */
export function serializeThroughTiptap(md: string): string {
  const editor = new Editor({
    extensions: createBlogEditorExtensions(),
    content: md,
    editable: false,
  });
  try {
    return (editor.storage.markdown as MarkdownStorage).getMarkdown();
  } finally {
    editor.destroy();
  }
}
