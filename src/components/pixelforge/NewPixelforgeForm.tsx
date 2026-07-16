"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Brain, FileText, Loader2, Sparkles, Users } from "lucide-react";
import { createPixelforgeProjectAction } from "@/app/(admin)/proyectos/pixelforge/actions";

export interface ClientOption {
  crmId: string;
  name: string;
}

export interface DefinitionOption {
  id: string;
  title: string;
  clientCrmId: string;
}

interface Props {
  clients: ClientOption[];
  definitions: DefinitionOption[];
}

const MIN_BRAIN_DUMP = 20;
const DRAFT_KEY = "pixelforge:new-draft";

interface Draft {
  clientCrmId?: string;
  title?: string;
  brainDump?: string;
  definitionId?: string;
}

/** Punto de entrada de un proyecto PixelForge: cliente + nombre + descarga mental. */
export function NewPixelforgeForm({ clients, definitions }: Props) {
  const router = useRouter();
  const [clientCrmId, setClientCrmId] = useState("");
  const [title, setTitle] = useState("");
  const [brainDump, setBrainDump] = useState("");
  const [definitionId, setDefinitionId] = useState("");
  const [busy, setBusy] = useState(false);

  // Restaura un borrador de una sesión anterior — client-only, en un efecto
  // para no romper el render de servidor.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Draft;
      if (parsed.clientCrmId) setClientCrmId(parsed.clientCrmId);
      if (parsed.title) setTitle(parsed.title);
      if (parsed.brainDump) setBrainDump(parsed.brainDump);
      if (parsed.definitionId) setDefinitionId(parsed.definitionId);
    } catch {
      // localStorage no disponible (modo privado) o entrada corrupta: ignorar.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autoguardado silencioso mientras se escribe, debounce corto.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!clientCrmId && !title.trim() && !brainDump.trim()) return;
      try {
        window.localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({ clientCrmId, title, brainDump, definitionId })
        );
      } catch {
        // cuota excedida o modo privado: no bloquea el formulario.
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [clientCrmId, title, brainDump, definitionId]);

  const clientDefinitions = useMemo(
    () => definitions.filter((d) => d.clientCrmId === clientCrmId),
    [definitions, clientCrmId]
  );

  const valid =
    clientCrmId.trim().length > 0 &&
    title.trim().length > 0 &&
    brainDump.trim().length >= MIN_BRAIN_DUMP;

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    const r = await createPixelforgeProjectAction({
      clientCrmId,
      title: title.trim(),
      brainDump: brainDump.trim(),
      definitionId: definitionId || undefined,
    });
    if (!r.success || !r.data) {
      toast.error(r.error ?? "No se pudo crear el proyecto");
      setBusy(false);
      return;
    }
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {
      // no bloquea la navegación si falla.
    }
    router.push(`/proyectos/pixelforge/${r.data.id}`);
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="mb-6">
        <div className="mb-1 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-cyan-400" />
          <h1 className="text-lg font-semibold text-foreground">Nuevo Proyecto PixelForge</h1>
        </div>
        <p className="text-xs text-muted-foreground">
          La IA te va a acompañar por 8 estaciones para producir la landing.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <label
          htmlFor="pixelforge-client"
          className="mb-2 flex items-center gap-1.5 text-sm font-medium text-foreground"
        >
          <Users className="h-4 w-4 text-muted-foreground" />
          Cliente
        </label>
        <select
          id="pixelforge-client"
          value={clientCrmId}
          onChange={(e) => {
            setClientCrmId(e.target.value);
            setDefinitionId("");
          }}
          className="w-full rounded-md border border-border bg-secondary/40 px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
        >
          <option value="">Selecciona un cliente</option>
          {clients.map((c) => (
            <option key={c.crmId} value={c.crmId}>
              {c.name}
            </option>
          ))}
        </select>

        <label
          htmlFor="pixelforge-title"
          className="mb-2 mt-5 flex items-center gap-1.5 text-sm font-medium text-foreground"
        >
          <FileText className="h-4 w-4 text-muted-foreground" />
          Título del proyecto
        </label>
        <input
          id="pixelforge-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          placeholder="Título del proyecto"
          className="w-full rounded-md border border-border bg-secondary/40 px-3.5 py-2.5 text-sm text-foreground placeholder-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
        />

        <label
          htmlFor="pixelforge-brain-dump"
          className="mb-2 mt-5 flex items-center gap-1.5 text-sm font-medium text-foreground"
        >
          <Brain className="h-4 w-4 text-muted-foreground" />
          Descarga mental
        </label>
        <textarea
          id="pixelforge-brain-dump"
          value={brainDump}
          onChange={(e) => setBrainDump(e.target.value)}
          rows={10}
          placeholder="Escribe tu idea, los problemas a solucionar o todo lo que tengas en la cabeza para poder aterrizarlo…"
          className="w-full resize-none rounded-md border border-border bg-secondary/40 px-3.5 py-3 text-sm text-foreground placeholder-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
        />
        <span className="mt-1 block text-[11px] text-muted-foreground/70">
          {brainDump.trim().length < MIN_BRAIN_DUMP
            ? "Escribe al menos un par de frases"
            : `${brainDump.trim().length} caracteres`}
        </span>

        {clientCrmId &&
          (clientDefinitions.length > 0 ? (
            <>
              <label
                htmlFor="pixelforge-definition"
                className="mb-2 mt-5 flex items-center gap-1.5 text-sm font-medium text-foreground"
              >
                Importar de Definición (opcional)
              </label>
              <select
                id="pixelforge-definition"
                value={definitionId}
                onChange={(e) => setDefinitionId(e.target.value)}
                className="w-full rounded-md border border-border bg-secondary/40 px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
              >
                <option value="">Ninguna</option>
                {clientDefinitions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <p className="mt-5 text-[11px] text-muted-foreground/70">
              Este cliente no tiene definiciones completadas.
            </p>
          ))}

        <div className="mt-5 flex items-center justify-end">
          <button
            type="button"
            onClick={submit}
            disabled={!valid || busy}
            className="flex items-center gap-2 rounded-md bg-cyan-500 px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-cyan-400 disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Crear proyecto
          </button>
        </div>
      </div>
    </div>
  );
}
