"use client";

import { Plus, Trash2 } from "lucide-react";
import type { BlogPostEditInput } from "@/lib/blog/schemas";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type InternalLinkItem = NonNullable<BlogPostEditInput["internalLinks"]>[number];

function emptyLink(): InternalLinkItem {
  return { targetUrl: "", anchor: "", placement: "", verified: false };
}

interface InternalLinksEditorProps {
  value: InternalLinkItem[];
  onChange: (links: InternalLinkItem[]) => void;
}

/** Enlaces internos declarados (a servicios o artículos relacionados).
 *  "Verificado" es una confirmación humana de que el destino existe. */
export function InternalLinksEditor({ value, onChange }: InternalLinksEditorProps) {
  function updateAt(index: number, patch: Partial<InternalLinkItem>) {
    onChange(value.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-4">
      {value.length === 0 && (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          Sin enlaces internos declarados. Enlazar servicios o artículos
          relacionados fortalece la arquitectura SEO del sitio (advertencia en
          el gate de publicación, no bloqueo).
        </p>
      )}

      {value.map((link, index) => (
        <div
          key={index}
          className="space-y-3 rounded-xl border border-border bg-card p-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Enlace {index + 1}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeAt(index)}
              className="h-8 px-2 text-red-400 hover:bg-red-500/10 hover:text-red-300"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">URL destino</Label>
              <Input
                value={link.targetUrl}
                onChange={(e) => updateAt(index, { targetUrl: e.target.value })}
                placeholder="/servicios/automatizacion o https://pixeltec.mx/…"
                className="bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500/50"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Anchor (texto del enlace)</Label>
              <Input
                value={link.anchor}
                onChange={(e) => updateAt(index, { anchor: e.target.value })}
                maxLength={120}
                placeholder="ej. automatización de procesos"
                className="bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500/50"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Ubicación (opcional)</Label>
              <Input
                value={link.placement ?? ""}
                onChange={(e) => updateAt(index, { placement: e.target.value })}
                maxLength={200}
                placeholder="ej. sección de conclusiones"
                className="bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500/50"
              />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                <Checkbox
                  checked={link.verified}
                  onCheckedChange={(checked) => updateAt(index, { verified: checked === true })}
                />
                Destino verificado
              </label>
            </div>
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={() => onChange([...value, emptyLink()])}
        disabled={value.length >= 20}
        className="w-full border-blue-500/30 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300 disabled:opacity-40"
      >
        <Plus className="mr-2 h-4 w-4" />
        Agregar enlace interno
      </Button>
    </div>
  );
}
