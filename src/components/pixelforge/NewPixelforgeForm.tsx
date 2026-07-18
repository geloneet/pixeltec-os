"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Brain, FileText, Loader2, Sparkles, Users } from "lucide-react";
import { createPixelforgeProjectAction } from "@/app/(admin)/proyectos/pixelforge/actions";
import { ForgeZone } from "@/components/pixelforge/forge/ForgeZone";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
// Radix Select no permite value="" en un Item (ese valor está reservado para
// "sin selección"/placeholder) — usamos un sentinel para "Ninguna" y lo
// traducimos a "" al guardar en el estado (mismo contrato que el <select> nativo).
const NONE_DEFINITION = "__none__";

const pfxSelectTriggerClass =
  "w-full rounded-[var(--pfx-radius)] border border-pfx-border bg-pfx-surface px-3.5 py-2.5 text-sm text-pfx-text focus:outline-none focus:ring-2 focus:ring-pfx-accent focus:ring-offset-0 data-[placeholder]:text-pfx-text-muted/70";
const pfxSelectContentClass = "border-pfx-border bg-pfx-surface-elevated text-pfx-text";
const pfxSelectItemClass = "text-pfx-text focus:bg-pfx-accent/10 focus:text-pfx-text";

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
    // Directo a la estación inicial: pasar por el [id] pelado encadena un
    // segundo redirect server-side y ese doble salto de pathname crashea el
    // AnimatePresence del shell admin (mismo root cause que el listado, PF-H1).
    router.push(`/proyectos/pixelforge/${r.data.id}/${r.data.station}`);
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="mb-6">
        <div className="mb-1 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-pfx-accent" />
          <h1 className="text-xl font-extrabold tracking-[-0.02em] text-pfx-text">
            Nuevo Proyecto PixelForge
          </h1>
        </div>
        <p className="text-xs text-pfx-text-muted">
          La IA te va a acompañar por{" "}
          <span className="font-forge-mono text-pfx-text">8 estaciones</span> para producir la
          landing.
        </p>
      </div>

      <ForgeZone variant="elevated" className="p-5">
        <label
          htmlFor="pixelforge-client"
          className="mb-2 flex items-center gap-1.5 text-sm font-medium text-pfx-text"
        >
          <Users className="h-4 w-4 text-pfx-text-muted" />
          Cliente
        </label>
        <Select
          value={clientCrmId}
          onValueChange={(v) => {
            setClientCrmId(v);
            setDefinitionId("");
          }}
        >
          <SelectTrigger id="pixelforge-client" className={pfxSelectTriggerClass}>
            <SelectValue placeholder="Selecciona un cliente" />
          </SelectTrigger>
          <SelectContent className={pfxSelectContentClass}>
            {clients.map((c) => (
              <SelectItem key={c.crmId} value={c.crmId} className={pfxSelectItemClass}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <label
          htmlFor="pixelforge-title"
          className="mb-2 mt-5 flex items-center gap-1.5 text-sm font-medium text-pfx-text"
        >
          <FileText className="h-4 w-4 text-pfx-text-muted" />
          Título del proyecto
        </label>
        <input
          id="pixelforge-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          placeholder="Título del proyecto"
          className="w-full rounded-[var(--pfx-radius)] border border-pfx-border bg-pfx-surface px-3.5 py-2.5 text-sm text-pfx-text placeholder:text-pfx-text-muted/60 focus:outline-none focus:ring-2 focus:ring-pfx-accent"
        />

        <label
          htmlFor="pixelforge-brain-dump"
          className="mb-2 mt-5 flex items-center gap-1.5 text-sm font-medium text-pfx-text"
        >
          <Brain className="h-4 w-4 text-pfx-text-muted" />
          Descarga mental
        </label>
        <textarea
          id="pixelforge-brain-dump"
          value={brainDump}
          onChange={(e) => setBrainDump(e.target.value)}
          rows={10}
          placeholder="Escribe tu idea, los problemas a solucionar o todo lo que tengas en la cabeza para poder aterrizarlo…"
          className="w-full resize-none rounded-[var(--pfx-radius)] border border-pfx-border bg-pfx-surface px-3.5 py-3 text-sm text-pfx-text placeholder:text-pfx-text-muted/60 focus:outline-none focus:ring-2 focus:ring-pfx-accent"
        />
        <span className="mt-1 block font-forge-mono text-[11px] text-pfx-text-muted">
          {brainDump.trim().length < MIN_BRAIN_DUMP
            ? "Escribe al menos un par de frases"
            : `${brainDump.trim().length} caracteres`}
        </span>

        {clientCrmId &&
          (clientDefinitions.length > 0 ? (
            <>
              <label
                htmlFor="pixelforge-definition"
                className="mb-2 mt-5 flex items-center gap-1.5 text-sm font-medium text-pfx-text"
              >
                Importar de Definición (opcional)
              </label>
              <Select
                value={definitionId || NONE_DEFINITION}
                onValueChange={(v) => setDefinitionId(v === NONE_DEFINITION ? "" : v)}
              >
                <SelectTrigger id="pixelforge-definition" className={pfxSelectTriggerClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={pfxSelectContentClass}>
                  <SelectItem value={NONE_DEFINITION} className={pfxSelectItemClass}>
                    Ninguna
                  </SelectItem>
                  {clientDefinitions.map((d) => (
                    <SelectItem key={d.id} value={d.id} className={pfxSelectItemClass}>
                      {d.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          ) : (
            <p className="mt-5 text-[11px] text-pfx-text-muted">
              Este cliente no tiene definiciones completadas.
            </p>
          ))}

        <div className="mt-6 flex items-center justify-end">
          <button
            type="button"
            onClick={submit}
            disabled={!valid || busy}
            className="inline-flex items-center gap-2 rounded-[var(--pfx-radius)] bg-pfx-accent px-4 py-2 text-sm font-semibold text-pfx-on-accent transition-colors hover:bg-pfx-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pfx-accent focus-visible:ring-offset-2 focus-visible:ring-offset-pfx-surface-elevated disabled:opacity-40 disabled:hover:bg-pfx-accent"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Crear proyecto
          </button>
        </div>
      </ForgeZone>
    </div>
  );
}
