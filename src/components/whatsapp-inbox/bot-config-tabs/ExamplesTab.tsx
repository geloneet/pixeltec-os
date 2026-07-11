"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import type { BotExample, BotExampleCreateInput } from "@/types/pixelbot-config";
import { ExampleEditor } from "./ExampleEditor";
import { extractErrorMessage } from "./_shared";

/** Biblioteca de ejemplos few-shot. El backend NO soporta editar ni borrar —
 * solo crear y activar/desactivar (desactivar es el "soft delete"). */
export function ExamplesTab() {
  const [examples, setExamples] = useState<BotExample[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/whatsapp-inbox/examples", { cache: "no-store" });
      const data = (await res.json()) as { examples?: BotExample[]; error?: string };
      if (!res.ok || !data.examples) throw new Error(extractErrorMessage(data, res.status));
      setExamples(data.examples);
    } catch (err) {
      toast.error(`No se pudieron cargar los ejemplos: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleCreate(data: BotExampleCreateInput) {
    const res = await fetch("/api/whatsapp-inbox/examples", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const body = (await res.json()) as { id?: number; error?: string };
    if (!res.ok) throw new Error(extractErrorMessage(body, res.status));
    toast.success("Ejemplo creado");
    await load();
  }

  async function handleToggleActive(example: BotExample, active: boolean) {
    // Optimista: refleja el cambio de inmediato, revierte si falla.
    setExamples((prev) => prev.map((e) => (e.id === example.id ? { ...e, active } : e)));
    const res = await fetch(`/api/whatsapp-inbox/examples/${example.id}/active`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    if (!res.ok) {
      setExamples((prev) => prev.map((e) => (e.id === example.id ? { ...e, active: example.active } : e)));
      const data = await res.json().catch(() => ({}));
      toast.error(`No se pudo actualizar: ${extractErrorMessage(data, res.status)}`);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-shrink-0 items-center justify-between pb-3">
        <p className="text-xs text-zinc-500">
          Máximo 2 ejemplos por respuesta (3 en empate o baja confianza) — seleccionados por
          intención + etiquetas + keywords, sin embeddings.
        </p>
        <button
          type="button"
          onClick={() => setEditorOpen(true)}
          className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-300 transition-all hover:bg-cyan-500/20"
        >
          <Plus className="h-3.5 w-3.5" />
          Nuevo ejemplo
        </button>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner size="md" className="text-zinc-500" />
        </div>
      ) : examples.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
          <Sparkles className="mx-auto mb-3 h-8 w-8 text-zinc-700" />
          <p className="mb-1 text-sm font-medium text-zinc-400">Sin ejemplos todavía</p>
          <p className="text-xs text-zinc-600">
            Agrega ejemplos de mensaje del cliente + respuesta ideal para guiar el tono del bot.
          </p>
        </div>
      ) : (
        <div className="grid flex-1 grid-cols-1 content-start gap-3 overflow-y-auto pb-4 sm:grid-cols-2 xl:grid-cols-3">
          {examples.map((ex) => (
            <div
              key={ex.id}
              className="flex flex-col gap-2 rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap gap-1">
                  {ex.category && (
                    <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-300">
                      {ex.category}
                    </span>
                  )}
                  {ex.intent && (
                    <span className="rounded-full border border-zinc-700 bg-zinc-800/60 px-2 py-0.5 text-[10px] text-zinc-400">
                      {ex.intent}
                    </span>
                  )}
                </div>
                <Switch checked={ex.active} onCheckedChange={(v) => void handleToggleActive(ex, v)} />
              </div>
              <p className="line-clamp-2 text-xs font-medium text-zinc-200">{ex.customer_msg}</p>
              <p className="line-clamp-3 text-xs text-zinc-500">{ex.ideal_reply}</p>
              {ex.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {ex.tags.slice(0, 4).map((t) => (
                    <span key={t} className="rounded-md bg-zinc-800/60 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                      {t}
                    </span>
                  ))}
                </div>
              )}
              {!ex.active && (
                <span className="text-[10px] font-medium text-amber-400/80">Desactivado</span>
              )}
            </div>
          ))}
        </div>
      )}

      {editorOpen && (
        <ExampleEditor onSave={handleCreate} onClose={() => setEditorOpen(false)} />
      )}
    </div>
  );
}
