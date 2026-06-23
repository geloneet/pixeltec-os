"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import type { IATemplate, IATemplateType } from "@/types/documents";
import { IA_TEMPLATE_TYPES, IA_TEMPLATE_TYPE_LABELS } from "@/types/documents";
import { extractVariables } from "@/lib/documents/ia-templates";
import { cn } from "@/lib/utils";

interface Props {
  template: IATemplate | null; // null = create mode
  onSave: (data: Omit<IATemplate, "id" | "uid" | "createdAt" | "updatedAt">) => Promise<void>;
  onClose: () => void;
}

export function IATemplateEditor({ template, onSave, onClose }: Props) {
  const [name, setName] = useState(template?.name ?? "");
  const [type, setType] = useState<IATemplateType>(template?.type ?? "contrato");
  const [description, setDescription] = useState(template?.description ?? "");
  const [content, setContent] = useState(template?.content ?? "");
  const [isDefault, setIsDefault] = useState(template?.isDefault ?? false);
  const [saving, setSaving] = useState(false);

  const detectedVars = extractVariables(content);

  useEffect(() => {
    if (template) {
      setName(template.name);
      setType(template.type);
      setDescription(template.description);
      setContent(template.content);
      setIsDefault(template.isDefault);
    }
  }, [template]);

  const handleSave = async () => {
    if (!name.trim() || !content.trim()) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        type,
        description: description.trim(),
        content: content.trim(),
        variables: detectedVars,
        isDefault,
        version: template?.version ?? 1,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50" onClick={onClose} />
      <div className="flex h-full w-full max-w-xl flex-col border-l border-white/[0.06] bg-[#0F0F12] shadow-2xl">
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-white/[0.06] px-6 py-4">
          <h2 className="text-sm font-bold text-zinc-100">
            {template ? "Editar plantilla" : "Nueva plantilla"}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Name */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">Nombre</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-white/[0.06] bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-cyan-500/40 focus:outline-none"
              placeholder="Contrato de servicios web"
            />
          </div>

          {/* Type */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">Tipo</label>
            <div className="grid grid-cols-3 gap-1.5">
              {IA_TEMPLATE_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={cn(
                    "rounded-lg border py-1.5 text-xs font-medium transition-all",
                    type === t
                      ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
                      : "border-white/[0.06] bg-zinc-900/40 text-zinc-500 hover:text-zinc-300",
                  )}
                >
                  {IA_TEMPLATE_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">Descripción</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-white/[0.06] bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-cyan-500/40 focus:outline-none"
              placeholder="Descripción breve de la plantilla"
            />
          </div>

          {/* Content */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">
              Contenido{" "}
              <span className="text-zinc-600 font-normal">— usa {"{{"} variable {"}}"}  para insertar campos</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={12}
              className="w-full rounded-lg border border-white/[0.06] bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-cyan-500/40 focus:outline-none resize-y font-mono"
              placeholder={"CONTRATO DE SERVICIOS\n\nEntre {{nombre_empresa}} y PixelTEC...\n\nFecha: {{fecha_inicio}}\nMonto: ${{monto}} MXN"}
            />
          </div>

          {/* Detected variables */}
          {detectedVars.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-zinc-400">Variables detectadas</p>
              <div className="flex flex-wrap gap-1.5">
                {detectedVars.map((v) => (
                  <span key={v} className="rounded-md bg-zinc-800/60 px-2 py-0.5 font-mono text-[11px] text-zinc-300">
                    {`{{${v}}}`}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* isDefault toggle */}
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-600 bg-zinc-900 accent-cyan-500"
            />
            <span className="text-sm text-zinc-400">Marcar como plantilla predeterminada</span>
          </label>
        </div>

        {/* Footer */}
        <div className="flex flex-shrink-0 gap-2 border-t border-white/[0.06] px-6 py-4">
          <button
            onClick={handleSave}
            disabled={!name.trim() || !content.trim() || saving}
            className="flex-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 py-2.5 text-sm font-medium text-cyan-300 transition-all hover:bg-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "Guardando..." : template ? "Guardar cambios" : "Crear plantilla"}
          </button>
          <button
            onClick={onClose}
            className="rounded-lg border border-white/[0.06] px-4 py-2.5 text-sm text-zinc-500 hover:text-zinc-300 transition-all"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
