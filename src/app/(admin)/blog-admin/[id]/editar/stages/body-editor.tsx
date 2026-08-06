"use client";

/**
 * B-PR8 — Editor del cuerpo con dos modos sobre el MISMO form field `body`:
 *
 *   - «Editor visual» (Tiptap sobre Markdown, cargado con next/dynamic
 *     ssr:false): modo por defecto SOLO si `markdownRoundtripSafe` confirma
 *     que el viaje Markdown → ProseMirror → Markdown no pierde nada.
 *   - «Markdown» (el Textarea de siempre): fallback permanente, y modo
 *     forzoso —con aviso ámbar— cuando el post tiene HTML crudo u otro
 *     formato que el editor visual no conserva fielmente.
 *
 * El valor fluye por `onChange` del field (setValue con shouldDirty), así que
 * el contrato del autosave (debounce 5 s en post-editor-client) NO cambia.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { CircleAlert, Eye, FileCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { markdownRoundtripSafe } from "@/lib/blog/markdown-roundtrip";

// Tiptap solo entra al bundle del cliente de esta ruta, nunca al SSR.
const RichMarkdownEditor = dynamic(
  () => import("@/components/blog/rich-markdown-editor"),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-2 rounded-lg border border-border p-4" aria-hidden="true">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    ),
  },
);

const UNSAFE_NOTICE =
  "Este artículo contiene HTML u otro formato que el editor visual no conserva fielmente — se abre en Markdown.";

type Mode = "checking" | "visual" | "markdown";

interface BodyEditorProps {
  value: string;
  onChange: (markdown: string) => void;
}

export function BodyEditor({ value, onChange }: BodyEditorProps) {
  const [mode, setMode] = useState<Mode>("checking");
  const [notice, setNotice] = useState<string | null>(null);
  // El valor vivo, accesible desde callbacks sin re-suscribir efectos.
  const valueRef = useRef(value);
  valueRef.current = value;

  /** Verifica el roundtrip con el serializador REAL y entra a visual si es
   *  seguro; si no, cae a Markdown con aviso. El serializador se importa
   *  dinámicamente para no meter Tiptap en el bundle SSR. */
  const tryEnterVisual = useCallback(async () => {
    setMode("checking");
    try {
      const { serializeThroughTiptap } = await import(
        "@/components/blog/tiptap-roundtrip"
      );
      const verdict = markdownRoundtripSafe(valueRef.current, serializeThroughTiptap);
      if (verdict.safe) {
        setNotice(null);
        setMode("visual");
      } else {
        setNotice(UNSAFE_NOTICE);
        setMode("markdown");
      }
    } catch {
      // Si Tiptap no carga, el Textarea es el fallback permanente.
      setNotice("No se pudo cargar el editor visual — se abre en Markdown.");
      setMode("markdown");
    }
  }, []);

  // Al montar: decidir el modo con el contenido inicial.
  useEffect(() => {
    void tryEnterVisual();
  }, [tryEnterVisual]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end">
        {mode === "markdown" && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void tryEnterVisual()}
            className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <Eye className="h-3.5 w-3.5" />
            Editor visual
          </Button>
        )}
        {mode === "visual" && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setNotice(null);
              setMode("markdown");
            }}
            className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <FileCode className="h-3.5 w-3.5" />
            Ver Markdown
          </Button>
        )}
      </div>

      {/* Aviso ámbar: el modo visual no es fiable para este contenido. */}
      {notice && mode === "markdown" && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-lg border border-yellow-500/25 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-700 dark:text-yellow-300"
        >
          <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {notice}
        </p>
      )}

      {mode === "visual" ? (
        <RichMarkdownEditor value={value} onChange={onChange} />
      ) : (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={mode === "checking"}
          rows={24}
          aria-label="Cuerpo del artículo (Markdown)"
          placeholder="## Sección&#10;&#10;Escribe el contenido en Markdown…"
          className="bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500/50 resize-y font-mono text-sm"
        />
      )}
    </div>
  );
}
