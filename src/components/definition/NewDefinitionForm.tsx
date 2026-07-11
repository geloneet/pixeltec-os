"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Brain, Loader2, Sparkles } from "lucide-react";
import { createDefinitionAction } from "@/app/(admin)/proyectos/definicion/actions";

interface Props {
  clientCrmId: string;
  clientName: string;
}

/** La "descarga mental": el punto de entrada del pipeline de definición. */
export function NewDefinitionForm({ clientCrmId, clientName }: Props) {
  const router = useRouter();
  const [brainDump, setBrainDump] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (brainDump.trim().length < 20 || busy) return;
    setBusy(true);
    const r = await createDefinitionAction({ clientCrmId, brainDump: brainDump.trim() });
    if (!r.success || !r.data) {
      toast.error(r.error ?? "No se pudo crear la definición");
      setBusy(false);
      return;
    }
    router.push(`/proyectos/definicion/${r.data.id}`);
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="mb-6">
        <div className="mb-1 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-cyan-400" />
          <h1 className="text-lg font-semibold text-zinc-100">Nuevo Proyecto</h1>
        </div>
        <p className="text-xs text-zinc-500">
          Cliente: {clientName} · La IA (un PM retador) te va a acompañar por 4
          estaciones para aterrizar la idea.
        </p>
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-zinc-900/30 p-5">
        <label className="mb-2 flex items-center gap-1.5 text-sm font-medium text-zinc-200">
          <Brain className="h-4 w-4 text-zinc-400" />
          Descarga mental
        </label>
        <textarea
          value={brainDump}
          onChange={(e) => setBrainDump(e.target.value)}
          rows={10}
          autoFocus
          placeholder="Escribe tu idea, los problemas a solucionar o todo lo que tengas en la cabeza para poder aterrizarlo…"
          className="w-full resize-none rounded-md border border-zinc-700/50 bg-zinc-800 px-3.5 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
        />
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[11px] text-zinc-600">
            {brainDump.trim().length < 20
              ? "Escribe al menos un par de frases"
              : `${brainDump.trim().length} caracteres`}
          </span>
          <button
            type="button"
            onClick={submit}
            disabled={brainDump.trim().length < 20 || busy}
            className="flex items-center gap-2 rounded-md bg-cyan-500 px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-cyan-400 disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Comenzar definición
          </button>
        </div>
      </div>
    </div>
  );
}
