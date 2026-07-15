"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Brain, FileText, Loader2, Save, Sparkles } from "lucide-react";
import {
  startDefinitionAction,
  updateDraftAction,
} from "@/app/(admin)/proyectos/definicion/actions";
import type { DefinitionViewModel } from "@/components/definition/view-model";

interface Props {
  data: DefinitionViewModel;
}

const MIN_BRAIN_DUMP = 20;

/** Editor de una definición en `draft`: nombre + descarga mental editables, sin IA todavía. */
export function DraftEditor({ data }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(data.title);
  const [brainDump, setBrainDump] = useState(data.brainDump);
  const [busy, setBusy] = useState<"save" | "start" | null>(null);

  const valid = title.trim().length > 0 && brainDump.trim().length >= MIN_BRAIN_DUMP;

  // Autoguardado silencioso: espera 1.5s de inactividad y guarda en
  // background, sin toast — el toast explícito queda solo para el clic en
  // "Guardar borrador" (saveDraft, abajo).
  useEffect(() => {
    if (!valid) return;
    const timer = setTimeout(() => {
      updateDraftAction({
        definitionId: data.id,
        title: title.trim(),
        brainDump: brainDump.trim(),
      });
    }, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, brainDump]);

  const saveDraft = async () => {
    if (!valid || busy) return;
    setBusy("save");
    const r = await updateDraftAction({
      definitionId: data.id,
      title: title.trim(),
      brainDump: brainDump.trim(),
    });
    setBusy(null);
    if (!r.success) {
      toast.error(r.error ?? "No se pudo guardar el borrador");
      return;
    }
    toast.success("Borrador guardado");
  };

  const start = async () => {
    if (!valid || busy) return;
    setBusy("start");
    // Persistir cualquier edición pendiente antes de arrancar.
    const saved = await updateDraftAction({
      definitionId: data.id,
      title: title.trim(),
      brainDump: brainDump.trim(),
    });
    if (!saved.success) {
      toast.error(saved.error ?? "No se pudo guardar el borrador");
      setBusy(null);
      return;
    }
    const r = await startDefinitionAction({ definitionId: data.id });
    if (!r.success) {
      toast.error(r.error ?? "No se pudo iniciar la definición");
      setBusy(null);
      return;
    }
    router.refresh();
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="mb-6">
        <div className="mb-1 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          <h1 className="text-lg font-semibold text-foreground">Borrador</h1>
        </div>
        <p className="text-xs text-muted-foreground">
          Cliente: {data.clientName} · Todavía no arranca — edita lo que necesites y
          comienza la definición cuando estés listo.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <label className="mb-2 flex items-center gap-1.5 text-sm font-medium text-foreground">
          <FileText className="h-4 w-4 text-muted-foreground" />
          Nombre del proyecto
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          placeholder="Ej. Rediseño del portal de clientes"
          className="w-full rounded-md border border-border bg-secondary/40 px-3.5 py-2.5 text-sm text-foreground placeholder-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
        />

        <label className="mb-2 mt-5 flex items-center gap-1.5 text-sm font-medium text-foreground">
          <Brain className="h-4 w-4 text-muted-foreground" />
          Descarga mental
        </label>
        <textarea
          value={brainDump}
          onChange={(e) => setBrainDump(e.target.value)}
          rows={10}
          placeholder="Escribe tu idea, los problemas a solucionar o todo lo que tengas en la cabeza para poder aterrizarlo…"
          className="w-full resize-none rounded-md border border-border bg-secondary/40 px-3.5 py-3 text-sm text-foreground placeholder-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
        />
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground/70">
            {brainDump.trim().length < MIN_BRAIN_DUMP
              ? "Escribe al menos un par de frases"
              : `${brainDump.trim().length} caracteres`}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={saveDraft}
              disabled={!valid || busy !== null}
              className="flex items-center gap-2 rounded-md border border-border bg-transparent px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/60 disabled:opacity-40"
            >
              {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar borrador
            </button>
            <button
              type="button"
              onClick={start}
              disabled={!valid || busy !== null}
              className="flex items-center gap-2 rounded-md bg-cyan-500 px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-cyan-400 disabled:opacity-40"
            >
              {busy === "start" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Comenzar definición
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
