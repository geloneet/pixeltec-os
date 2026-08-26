"use client";

/**
 * Editor de una herramienta SEO (WO-2026-00095) — paridad con
 * `seo-tool-editor.tsx` de Muebles Encino.
 *
 * Contenido + interruptor de publicación + «Crear con IA». La IA propone; el
 * contenido no se guarda hasta que Miguel pulsa Guardar.
 */
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles } from "lucide-react";
import { SeoCard } from "./seo-ui";
import { saveSeoTool, generateSeoTool } from "@/lib/seo/actions";
import type { SeoTool } from "@/lib/seo/tools";

interface Props {
  tool: Pick<SeoTool, "key" | "title" | "description" | "format">;
  initialContent: string;
  initialEnabled: boolean;
  /** Dónde se ve publicado, si tiene superficie propia (p.ej. /robots.txt). */
  publicPath?: string;
}

export function SeoToolEditor({ tool, initialContent, initialEnabled, publicPath }: Props) {
  const [content, setContent] = useState(initialContent);
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, startSave] = useTransition();
  const [generating, setGenerating] = useState(false);

  const save = () =>
    startSave(async () => {
      const res = await saveSeoTool({ key: tool.key, content, enabled });
      if (res.ok) toast.success("Guardado.");
      else toast.error(res.error ?? "No se pudo guardar.");
    });

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await generateSeoTool(tool.key);
      if (res.ok && res.data) {
        setContent(res.data.content);
        toast.success("Propuesta lista. Revísala antes de guardar.");
      } else {
        toast.error(res.error ?? "No se pudo generar.");
      }
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <SeoCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4"
              aria-label="Publicar esta herramienta"
            />
            <span className="text-foreground">Publicar</span>
            <span className="text-xs text-muted-foreground">
              {enabled ? "Se está sirviendo al público." : "Guardado, pero sin publicar."}
            </span>
          </label>
          <Button type="button" variant="outline" size="sm" onClick={generate} disabled={generating}>
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            {generating ? "Generando…" : "Crear con IA"}
          </Button>
        </div>
      </SeoCard>

      <SeoCard title={tool.format === "json" ? "Contenido (JSON)" : "Contenido"}>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={18}
          spellCheck={false}
          aria-label={`Contenido de ${tool.title}`}
          className="font-mono text-xs"
          placeholder={
            tool.format === "json"
              ? "Pega o genera el JSON-LD…"
              : "Escribe o genera el contenido del archivo…"
          }
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
          {publicPath ? (
            <a
              href={publicPath}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Ver {publicPath}
            </a>
          ) : null}
        </div>
      </SeoCard>
    </div>
  );
}
