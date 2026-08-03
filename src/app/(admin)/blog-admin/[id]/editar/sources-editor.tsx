"use client";

import { Plus, Trash2 } from "lucide-react";
import type { PostSourceInput } from "@/lib/blog/schemas";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SOURCE_TYPE_OPTIONS: { value: PostSourceInput["sourceType"]; label: string }[] = [
  { value: "official", label: "Oficial" },
  { value: "primary-research", label: "Investigación primaria" },
  { value: "regulation", label: "Regulación / norma" },
  { value: "technical-documentation", label: "Documentación técnica" },
  { value: "reputable-secondary", label: "Secundaria confiable" },
  { value: "pixeltec-evidence", label: "Evidencia PixelTEC" },
];

function emptySource(): PostSourceInput {
  return {
    id: crypto.randomUUID(),
    title: "",
    url: "",
    publisher: "",
    sourceType: "official",
    claimSupported: "",
    accessedAt: "",
    verifiedByHuman: false,
  };
}

interface SourcesEditorProps {
  value: PostSourceInput[];
  onChange: (sources: PostSourceInput[]) => void;
}

/** Editor de fuentes. La verificación es una decisión HUMANA (checkbox):
 *  nunca se hace fetch de las URLs desde aquí ni desde el servidor (SSRF). */
export function SourcesEditor({ value, onChange }: SourcesEditorProps) {
  function updateAt(index: number, patch: Partial<PostSourceInput>) {
    onChange(value.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-4">
      {value.length === 0 && (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          Sin fuentes declaradas. Las afirmaciones verificables del artículo
          deberían respaldarse con fuentes; toda fuente sin verificación humana
          bloquea la publicación.
        </p>
      )}

      {value.map((source, index) => (
        <div key={source.id} className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Fuente {index + 1}
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
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs text-muted-foreground">Título</Label>
              <Input
                value={source.title}
                onChange={(e) => updateAt(index, { title: e.target.value })}
                maxLength={300}
                placeholder="Título del documento o página"
                className="bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500/50"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs text-muted-foreground">URL</Label>
              <Input
                value={source.url}
                onChange={(e) => updateAt(index, { url: e.target.value })}
                placeholder="https://…"
                className="bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500/50"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Publicador</Label>
              <Input
                value={source.publisher}
                onChange={(e) => updateAt(index, { publisher: e.target.value })}
                maxLength={200}
                placeholder="ej. INEGI, AWS, DOF"
                className="bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500/50"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Tipo de fuente</Label>
              <Select
                value={source.sourceType}
                onValueChange={(v) =>
                  updateAt(index, { sourceType: v as PostSourceInput["sourceType"] })
                }
              >
                <SelectTrigger className="bg-background border-border text-foreground focus:border-blue-500/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-border bg-popover/95 backdrop-blur-xl">
                  {SOURCE_TYPE_OPTIONS.map((opt) => (
                    <SelectItem
                      key={opt.value}
                      value={opt.value}
                      className="text-popover-foreground focus:bg-secondary focus:text-foreground"
                    >
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs text-muted-foreground">Afirmación que respalda</Label>
              <Textarea
                value={source.claimSupported}
                onChange={(e) => updateAt(index, { claimSupported: e.target.value })}
                rows={2}
                maxLength={500}
                placeholder="Qué afirmación concreta del artículo respalda esta fuente"
                className="bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500/50 resize-none"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Fecha de consulta</Label>
              <Input
                type="date"
                value={source.accessedAt ? source.accessedAt.slice(0, 10) : ""}
                onChange={(e) => updateAt(index, { accessedAt: e.target.value })}
                className="bg-background border-border text-foreground focus:border-blue-500/50"
              />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                <Checkbox
                  checked={source.verifiedByHuman}
                  onCheckedChange={(checked) =>
                    updateAt(index, { verifiedByHuman: checked === true })
                  }
                />
                Verificada por un humano
              </label>
            </div>
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={() => onChange([...value, emptySource()])}
        disabled={value.length >= 20}
        className="w-full border-blue-500/30 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300 disabled:opacity-40"
      >
        <Plus className="mr-2 h-4 w-4" />
        Agregar fuente
      </Button>
    </div>
  );
}
