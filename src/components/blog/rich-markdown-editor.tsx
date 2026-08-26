"use client";

/**
 * B-PR8 — Editor visual (Tiptap v2) sobre Markdown.
 *
 * El Markdown sigue siendo el almacenamiento: `value` se deserializa al
 * montar y cada cambio se re-serializa a Markdown (debounce interno corto)
 * hacia `onChange`, que fluye por el mismo form field `body` de siempre.
 *
 * Export default a propósito: se carga con `next/dynamic({ ssr: false })`
 * SOLO en la ruta del editor (decisión D1 del plan) — Tiptap no debe entrar
 * en el bundle SSR ni en el resto del sitio.
 */

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import {
  Bold,
  Code,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  Redo2,
  Table as TableIcon,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { createBlogEditorExtensions } from "./tiptap-extensions";

/** Debounce corto de serialización: no spamear el form (que ya tiene su
 *  propio debounce de autosave de 5 s) en cada tecla. */
const SERIALIZE_DEBOUNCE_MS = 300;

interface MarkdownStorage {
  getMarkdown(): string;
}

interface RichMarkdownEditorProps {
  value: string;
  onChange: (markdown: string) => void;
  /**
   * WO-2026-00088 (Blog, paridad Encino): sube un archivo de imagen y devuelve
   * su URL pública (R2). Opcional: sin él, el diálogo de imagen solo acepta URL
   * (comportamiento previo del blog-admin legacy, intacto).
   */
  onUploadImage?: (file: File) => Promise<string>;
}

export default function RichMarkdownEditor({ value, onChange, onUploadImage }: RichMarkdownEditorProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Último Markdown emitido/recibido: evita re-deserializar el contenido
  // cuando el cambio del form lo originó este mismo editor.
  const lastMarkdownRef = useRef(value);

  const editor = useEditor({
    extensions: createBlogEditorExtensions(),
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose prose-invert max-w-none min-h-[24rem] px-4 py-3 focus:outline-none",
        "aria-label": "Cuerpo del artículo (editor visual)",
        role: "textbox",
        "aria-multiline": "true",
      },
    },
    onUpdate: ({ editor: e }) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const md = (e.storage.markdown as MarkdownStorage).getMarkdown();
        lastMarkdownRef.current = md;
        onChange(md);
      }, SERIALIZE_DEBOUNCE_MS);
    },
  });

  // Cambios EXTERNOS de `body` (Herramientas de IA, restaurar versión…):
  // se re-deserializa solo si el valor no salió de este editor.
  useEffect(() => {
    if (!editor || value === lastMarkdownRef.current) return;
    lastMarkdownRef.current = value;
    editor.commands.setContent(value, false);
  }, [value, editor]);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  return (
    <div className="rounded-lg border border-border bg-background focus-within:border-blue-500/50">
      <EditorToolbar editor={editor} onUploadImage={onUploadImage} />
      <EditorContent editor={editor} />
    </div>
  );
}

// ─── Toolbar ───────────────────────────────────────────────────────────────────

function EditorToolbar({
  editor,
  onUploadImage,
}: {
  editor: Editor | null;
  onUploadImage?: (file: File) => Promise<string>;
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [imageOpen, setImageOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleUpload(file: File | undefined) {
    if (!file || !onUploadImage) return;
    setUploading(true);
    setUploadError(null);
    try {
      setImageUrl(await onUploadImage(file));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "No se pudo subir la imagen");
    } finally {
      setUploading(false);
    }
  }

  if (!editor) {
    return <div className="h-10 border-b border-border" aria-hidden="true" />;
  }

  function openLinkDialog() {
    if (!editor) return;
    setLinkUrl((editor.getAttributes("link").href as string | undefined) ?? "");
    setLinkOpen(true);
  }

  function applyLink() {
    if (!editor) return;
    const url = linkUrl.trim();
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
    setLinkOpen(false);
  }

  function applyImage() {
    if (!editor) return;
    const src = imageUrl.trim();
    if (src !== "") {
      editor.chain().focus().setImage({ src, alt: imageAlt.trim() || undefined }).run();
    }
    setImageOpen(false);
    setImageUrl("");
    setImageAlt("");
  }

  return (
    <>
      <div
        role="toolbar"
        aria-label="Formato del editor visual"
        className="flex flex-wrap items-center gap-0.5 border-b border-border p-1"
      >
        <ToolbarButton
          label="Encabezado 2"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Encabezado 3"
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Párrafo"
          active={editor.isActive("paragraph")}
          onClick={() => editor.chain().focus().setParagraph().run()}
        >
          <Pilcrow className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarSeparator />
        <ToolbarButton
          label="Negritas"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Cursivas"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarSeparator />
        <ToolbarButton
          label="Lista"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Lista ordenada"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Cita"
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Bloque de código"
          active={editor.isActive("codeBlock")}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          <Code className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarSeparator />
        <ToolbarButton
          label="Enlace"
          active={editor.isActive("link")}
          onClick={openLinkDialog}
        >
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Imagen" onClick={() => setImageOpen(true)}>
          <ImageIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Tabla 3×3"
          active={editor.isActive("table")}
          onClick={() =>
            editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
          }
        >
          <TableIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Separador horizontal"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          <Minus className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarSeparator />
        <ToolbarButton
          label="Deshacer"
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Rehacer"
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 className="h-4 w-4" />
        </ToolbarButton>
      </div>

      {/* ── Diálogo: enlace ── */}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="border-border bg-background text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enlace</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Deja la URL vacía para quitar el enlace de la selección.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://…"
            aria-label="URL del enlace"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyLink();
              }
            }}
            className="bg-background border-border text-foreground"
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setLinkOpen(false)}
              className="border-border bg-secondary/50 text-foreground hover:bg-secondary"
            >
              Cancelar
            </Button>
            <Button type="button" onClick={applyLink} className="bg-blue-600 text-white hover:bg-blue-500">
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Diálogo: imagen ── */}
      <Dialog open={imageOpen} onOpenChange={setImageOpen}>
        <DialogContent className="border-border bg-background text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Imagen</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              URL de la imagen y texto alternativo (accesibilidad).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {onUploadImage && (
              <div className="space-y-1">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  aria-label="Subir imagen"
                  disabled={uploading}
                  onChange={(e) => void handleUpload(e.target.files?.[0])}
                  className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-secondary/60 file:px-3 file:py-1.5 file:text-xs file:text-foreground"
                />
                {uploading && <p className="text-xs text-muted-foreground">Subiendo…</p>}
                {uploadError && <p className="text-xs text-red-400">{uploadError}</p>}
              </div>
            )}
            <Input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://…"
              aria-label="URL de la imagen"
              className="bg-background border-border text-foreground"
            />
            <Input
              value={imageAlt}
              onChange={(e) => setImageAlt(e.target.value)}
              placeholder="Texto alternativo"
              aria-label="Texto alternativo de la imagen"
              className="bg-background border-border text-foreground"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setImageOpen(false)}
              className="border-border bg-secondary/50 text-foreground hover:bg-secondary"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={applyImage}
              disabled={imageUrl.trim() === ""}
              className="bg-blue-600 text-white hover:bg-blue-500"
            >
              Insertar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ToolbarButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-8 w-8 p-0 text-muted-foreground hover:bg-secondary hover:text-foreground",
        active && "bg-secondary text-foreground",
      )}
    >
      {children}
    </Button>
  );
}

function ToolbarSeparator() {
  return <div aria-hidden="true" className="mx-1 h-5 w-px bg-border" />;
}
