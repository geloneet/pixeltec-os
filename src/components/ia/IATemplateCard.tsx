"use client";

import { Trash2, Pencil } from "lucide-react";
import type { IATemplate } from "@/types/documents";
import { IA_TEMPLATE_TYPE_LABELS } from "@/types/documents";
import { cn } from "@/lib/utils";

const TYPE_COLORS: Record<string, string> = {
  contrato:   "bg-blue-500/15 text-blue-300 border-blue-500/20",
  factura:    "bg-green-500/15 text-green-300 border-green-500/20",
  discovery:  "bg-purple-500/15 text-purple-300 border-purple-500/20",
  estrategia: "bg-amber-500/15 text-amber-300 border-amber-500/20",
  bienvenida: "bg-pink-500/15 text-pink-300 border-pink-500/20",
  propuesta:  "bg-cyan-500/15 text-cyan-300 border-cyan-500/20",
};

interface Props {
  template: IATemplate;
  onEdit: (template: IATemplate) => void;
  onDelete: (id: string) => void;
}

export function IATemplateCard({ template, onEdit, onDelete }: Props) {
  return (
    <div className="group relative flex flex-col gap-2 rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4 transition-all hover:border-white/[0.10] hover:bg-zinc-900/40">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <span className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium mb-1.5",
            TYPE_COLORS[template.type] ?? "bg-zinc-500/15 text-zinc-300 border-zinc-500/20",
          )}>
            {IA_TEMPLATE_TYPE_LABELS[template.type]}
          </span>
          <h3 className="truncate text-sm font-semibold text-zinc-100">{template.name}</h3>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={() => onEdit(template)}
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200 transition-all"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDelete(template.id)}
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-red-500/10 hover:text-red-400 transition-all"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {template.description && (
        <p className="text-xs text-zinc-500 line-clamp-2">{template.description}</p>
      )}
      {template.variables.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {template.variables.slice(0, 4).map((v) => (
            <span key={v} className="rounded-md bg-zinc-800/60 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
              {`{{${v}}}`}
            </span>
          ))}
          {template.variables.length > 4 && (
            <span className="text-[10px] text-zinc-600">+{template.variables.length - 4} más</span>
          )}
        </div>
      )}
    </div>
  );
}
