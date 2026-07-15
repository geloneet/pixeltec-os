"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Brain, FileText, Loader2, Save, Sparkles } from "lucide-react";
import { createDefinitionAction } from "@/app/(admin)/proyectos/definicion/actions";

interface Props {
  clientCrmId: string;
  clientName: string;
}

const MIN_BRAIN_DUMP = 20;

/** Punto de entrada del pipeline de definición: nombre + "descarga mental". */
export function NewDefinitionForm({ clientCrmId, clientName }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [brainDump, setBrainDump] = useState("");
  const [busy, setBusy] = useState<"draft" | "start" | null>(null);

  const draftKey = `definicion-draft-${clientCrmId}`;

  // Restaura un borrador sin guardar de una sesión anterior (localStorage es
  // client-only: se hace en un efecto, no en el useState inicial, para no
  // romper el render de servidor).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { title?: string; brainDump?: string };
      if (parsed.title) setTitle(parsed.title);
      if (parsed.brainDump) setBrainDump(parsed.brainDump);
    } catch {
      // localStorage no disponible (modo privado) o entrada corrupta: ignorar.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autoguardado silencioso mientras se escribe, debounce corto.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!title.trim() && !brainDump.trim()) return;
      try {
        window.localStorage.setItem(draftKey, JSON.stringify({ title, brainDump }));
      } catch {
        // cuota excedida o modo privado: no bloquea el formulario.
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [title, brainDump, draftKey]);

  const valid = title.trim().length > 0 && brainDump.trim().length >= MIN_BRAIN_DUMP;

  const submit = async (start: boolean) => {
    if (!valid || busy) return;
    setBusy(start ? "start" : "draft");
    const r = await createDefinitionAction({
      clientCrmId,
      title: title.trim(),
      brainDump: brainDump.trim(),
      start,
    });
    if (!r.success || !r.data) {
      toast.error(r.error ?? "No se pudo crear la definición");
      setBusy(null);
      return;
    }
    try {
      window.localStorage.removeItem(draftKey);
    } catch {
      // no bloquea la navegación si falla.
    }
    if (start) {
      router.push(`/proyectos/definicion/${r.data.id}`);
    } else {
      toast.success("Borrador guardado");
      router.push("/proyectos/definicion");
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="mb-6">
        <div className="mb-1 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-cyan-400" />
          <h1 className="text-lg font-semibold text-foreground">Nuevo Proyecto</h1>
        </div>
        <p className="text-xs text-muted-foreground">
          Cliente: {clientName} · La IA (un PM retador) te va a acompañar por 4
          estaciones para aterrizar la idea.
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
          autoFocus
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
              onClick={() => submit(false)}
              disabled={!valid || busy !== null}
              className="flex items-center gap-2 rounded-md border border-border bg-transparent px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/60 disabled:opacity-40"
            >
              {busy === "draft" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar borrador
            </button>
            <button
              type="button"
              onClick={() => submit(true)}
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
