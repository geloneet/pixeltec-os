"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Sparkles } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import type { IATemplate, IATemplateType } from "@/types/documents";
import { IA_TEMPLATE_TYPES, IA_TEMPLATE_TYPE_LABELS } from "@/types/documents";
import {
  getTemplates, createTemplate, updateTemplate, deleteTemplate,
} from "@/lib/documents/ia-templates";
import { IATemplateCard } from "@/components/ia/IATemplateCard";
import { IATemplateEditor } from "@/components/ia/IATemplateEditor";
import { cn } from "@/lib/utils";

export default function IAFactoryPage() {
  const user = useUser();
  const [templates, setTemplates] = useState<IATemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState<IATemplateType | "all">("all");
  const [editorTemplate, setEditorTemplate] = useState<IATemplate | null | undefined>(undefined);
  // undefined = editor closed, null = create mode, IATemplate = edit mode

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getTemplates(user.uid, activeType === "all" ? undefined : activeType);
      setTemplates(data);
    } finally {
      setLoading(false);
    }
  }, [user, activeType]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (data: Omit<IATemplate, "id" | "uid" | "createdAt" | "updatedAt">) => {
    if (!user) return;
    if (editorTemplate) {
      await updateTemplate(editorTemplate.id, data);
    } else {
      await createTemplate(user.uid, data);
    }
    await load();
  };

  const handleDelete = async (id: string) => {
    await deleteTemplate(id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-white/[0.06] bg-zinc-950/40 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-cyan-400" />
            <h1 className="text-base font-bold text-zinc-100">Centro IA</h1>
          </div>
          <button
            onClick={() => setEditorTemplate(null)}
            className="flex items-center gap-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 px-3 py-1.5 text-xs font-medium text-cyan-300 hover:bg-cyan-500/20 transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            Nueva plantilla
          </button>
        </div>

        {/* Type filter tabs */}
        <div className="mt-3 flex items-center gap-0.5 overflow-x-auto scrollbar-none">
          {(["all", ...IA_TEMPLATE_TYPES] as const).map((t) => (
            <button
              key={t}
              onClick={() => setActiveType(t)}
              className={cn(
                "relative flex-shrink-0 px-3 py-1.5 text-xs font-medium transition-colors rounded-lg",
                activeType === t
                  ? "text-cyan-300 bg-cyan-500/10"
                  : "text-zinc-500 hover:text-zinc-300",
              )}
            >
              {t === "all" ? "Todas" : IA_TEMPLATE_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-zinc-600">
            Cargando plantillas...
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Sparkles className="mx-auto mb-3 h-8 w-8 text-zinc-700" />
            <p className="text-sm font-medium text-zinc-400 mb-1">Sin plantillas</p>
            <p className="text-xs text-zinc-600 mb-4">
              {activeType === "all"
                ? "Crea tu primera plantilla IA para contratos, facturas, discovery y más"
                : `No hay plantillas de tipo "${IA_TEMPLATE_TYPE_LABELS[activeType as IATemplateType]}"`}
            </p>
            <button
              onClick={() => setEditorTemplate(null)}
              className="rounded-lg bg-cyan-500/10 border border-cyan-500/20 px-4 py-2 text-xs font-medium text-cyan-300 hover:bg-cyan-500/20 transition-all"
            >
              + Crear plantilla
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {templates.map((t) => (
              <IATemplateCard
                key={t.id}
                template={t}
                onEdit={(tmpl) => setEditorTemplate(tmpl)}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Editor panel */}
      {editorTemplate !== undefined && (
        <IATemplateEditor
          template={editorTemplate}
          onSave={handleSave}
          onClose={() => setEditorTemplate(undefined)}
        />
      )}
    </div>
  );
}
