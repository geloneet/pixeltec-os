"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Link2, Loader2, Paperclip } from "lucide-react";
import { addContextSourceAction } from "@/app/(admin)/proyectos/pixelforge/actions";
import { ForgeZone } from "@/components/pixelforge/forge/ForgeZone";
import type { PixelforgeSourceType } from "@/lib/pixelforge/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  projectId: string;
}

type AddableSourceType = Exclude<PixelforgeSourceType, "definition_import">;

const SOURCE_TYPE_OPTIONS: { value: AddableSourceType; label: string }[] = [
  { value: "note", label: "Nota" },
  { value: "document", label: "Documento" },
  { value: "url", label: "URL" },
];

const pfxSelectTriggerClass =
  "mb-3 w-full rounded-[var(--pfx-radius)] border border-pfx-border bg-pfx-surface px-3.5 py-2.5 text-sm text-pfx-text focus:outline-none focus:ring-2 focus:ring-pfx-accent focus:ring-offset-0";
const pfxSelectContentClass = "border-pfx-border bg-pfx-surface-elevated text-pfx-text";
const pfxSelectItemClass = "text-pfx-text focus:bg-pfx-accent/10 focus:text-pfx-text";

const FIELD_LABEL_CLASS = "mb-1.5 block text-xs font-medium text-pfx-text-muted";

const INPUT_CLASS =
  "mb-3 w-full rounded-[var(--pfx-radius)] border border-pfx-border bg-pfx-surface px-3.5 py-2.5 text-sm text-pfx-text placeholder:text-pfx-text-muted/60 focus:outline-none focus:ring-2 focus:ring-pfx-accent";

/**
 * Formulario para anexar una fuente de contexto (estación Contexto, reskin
 * PF-X2 T1). El `<select>` ya era shadcn desde X1-T3 (solo se restyleó el
 * contenedor e inputs al idiom de forja).
 */
export function AddContextSourceForm({ projectId }: Props) {
  const router = useRouter();
  const [type, setType] = useState<AddableSourceType>("note");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const valid =
    title.trim().length > 0 && content.trim().length > 0 && (type !== "url" || url.trim().length > 0);

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    const r = await addContextSourceAction({
      projectId,
      type,
      title: title.trim(),
      content: content.trim(),
      url: type === "url" ? url.trim() : undefined,
    });
    setBusy(false);
    if (!r.success) {
      toast.error(r.error ?? "No se pudo anexar la fuente");
      return;
    }
    toast.success("Fuente anexada");
    setTitle("");
    setContent("");
    setUrl("");
    setType("note");
    router.refresh();
  };

  return (
    <ForgeZone variant="elevated" className="p-5">
      <div className="mb-3 flex items-center gap-1.5 text-sm font-medium text-pfx-text">
        <Paperclip className="h-4 w-4 text-pfx-accent" aria-hidden="true" />
        Anexar fuente de contexto
      </div>

      <label htmlFor="context-source-type" className={FIELD_LABEL_CLASS}>
        Tipo
      </label>
      <Select value={type} onValueChange={(v) => setType(v as AddableSourceType)}>
        <SelectTrigger id="context-source-type" className={pfxSelectTriggerClass}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className={pfxSelectContentClass}>
          {SOURCE_TYPE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className={pfxSelectItemClass}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <label htmlFor="context-source-title" className={FIELD_LABEL_CLASS}>
        Título
      </label>
      <input
        id="context-source-title"
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Ej. Sitio actual del cliente"
        className={INPUT_CLASS}
      />

      {type === "url" && (
        <>
          <label
            htmlFor="context-source-url"
            className="mb-1.5 flex items-center gap-1 text-xs font-medium text-pfx-text-muted"
          >
            <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
            URL
          </label>
          <input
            id="context-source-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://ejemplo.com"
            className={INPUT_CLASS}
          />
        </>
      )}

      <label htmlFor="context-source-content" className={FIELD_LABEL_CLASS}>
        Contenido
      </label>
      <textarea
        id="context-source-content"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={5}
        placeholder="Pega o describe el contenido de esta fuente…"
        className={`resize-none ${INPUT_CLASS}`}
      />

      <div className="mt-3 flex items-center justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={!valid || busy}
          className="flex items-center gap-2 rounded-[var(--pfx-radius)] bg-pfx-accent px-4 py-2 text-sm font-medium text-pfx-on-accent transition-colors hover:bg-pfx-accent-strong disabled:opacity-40"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Paperclip className="h-4 w-4" aria-hidden="true" />
          )}
          Anexar fuente
        </button>
      </div>
    </ForgeZone>
  );
}
