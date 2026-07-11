"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { BotExampleCreateInput } from "@/types/pixelbot-config";

interface Props {
  onSave: (data: BotExampleCreateInput) => Promise<void>;
  onClose: () => void;
}

const CUSTOMER_MSG_MAX = 500;
const IDEAL_REPLY_MAX = 1000;

/** Slide-over de creación de ejemplo few-shot (mismo patrón que
 * IATemplateEditor). El backend no soporta editar — solo crear y
 * activar/desactivar — por eso este editor no tiene modo edición. */
export function ExampleEditor({ onSave, onClose }: Props) {
  const [customerMsg, setCustomerMsg] = useState("");
  const [idealReply, setIdealReply] = useState("");
  const [category, setCategory] = useState("");
  const [intent, setIntent] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [manualPriority, setManualPriority] = useState(0);
  const [saving, setSaving] = useState(false);

  function addTag() {
    const trimmed = tagInput.trim();
    if (!trimmed || tags.includes(trimmed)) {
      setTagInput("");
      return;
    }
    setTags([...tags, trimmed]);
    setTagInput("");
  }

  const canSave = customerMsg.trim().length > 0 && idealReply.trim().length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave({
        customer_msg: customerMsg.trim(),
        ideal_reply: idealReply.trim(),
        category: category.trim() || null,
        intent: intent.trim() || null,
        tags,
        manual_priority: manualPriority,
        active: true,
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
        <div className="flex flex-shrink-0 items-center justify-between border-b border-white/[0.06] px-6 py-4">
          <h2 className="text-sm font-bold text-zinc-100">Nuevo ejemplo</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">Mensaje del cliente</label>
            <textarea
              value={customerMsg}
              onChange={(e) => setCustomerMsg(e.target.value)}
              maxLength={CUSTOMER_MSG_MAX}
              rows={3}
              className="w-full rounded-lg border border-white/[0.06] bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-cyan-500/40 focus:outline-none"
              placeholder="¿Cuánto cuesta una tienda en línea?"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">Respuesta ideal</label>
            <textarea
              value={idealReply}
              onChange={(e) => setIdealReply(e.target.value)}
              maxLength={IDEAL_REPLY_MAX}
              rows={5}
              className="w-full rounded-lg border border-white/[0.06] bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-cyan-500/40 focus:outline-none"
              placeholder="Te explico: va de $75k a $180k dependiendo de..."
            />
            <p className="mt-1 text-[11px] text-zinc-600">
              Usa datos ficticios/anonimizados — nunca información privada de clientes reales.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Categoría</label>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-white/[0.06] bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-cyan-500/40 focus:outline-none"
                placeholder="solicitud_precio"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Intención</label>
              <input
                value={intent}
                onChange={(e) => setIntent(e.target.value)}
                className="w-full rounded-lg border border-white/[0.06] bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-cyan-500/40 focus:outline-none"
                placeholder="cotizacion"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">Etiquetas</label>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span key={t} className="flex items-center gap-1 rounded-md bg-zinc-800/60 px-2 py-0.5 text-[11px] text-zinc-300">
                  {t}
                  <button onClick={() => setTags(tags.filter((x) => x !== t))} className="text-zinc-500 hover:text-zinc-200">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
            </div>
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
              className="w-full rounded-lg border border-white/[0.06] bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-cyan-500/40 focus:outline-none"
              placeholder="Escribe y presiona Enter…"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">
              Prioridad manual (0–20, desempate)
            </label>
            <input
              type="number"
              min={0}
              max={20}
              value={manualPriority}
              onChange={(e) => setManualPriority(Number(e.target.value))}
              className="w-24 rounded-lg border border-white/[0.06] bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 focus:border-cyan-500/40 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex flex-shrink-0 gap-2 border-t border-white/[0.06] px-6 py-4">
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="flex-1 rounded-lg border border-cyan-500/20 bg-cyan-500/10 py-2.5 text-sm font-medium text-cyan-300 transition-all hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Guardando..." : "Crear ejemplo"}
          </button>
          <button
            onClick={onClose}
            className="rounded-lg border border-white/[0.06] px-4 py-2.5 text-sm text-zinc-500 transition-all hover:text-zinc-300"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
