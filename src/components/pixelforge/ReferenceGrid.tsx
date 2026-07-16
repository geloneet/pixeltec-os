"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  FileText,
  Image as ImageIcon,
  Link2,
  Loader2,
  Sparkles,
  StickyNote,
  Trash2,
  Upload,
} from "lucide-react";
import {
  addUrlReferenceAction,
  addImageReferenceAction,
  addNoteReferenceAction,
  removeReferenceAction,
} from "@/app/(admin)/proyectos/pixelforge/actions";
import { usePixelforgeRun } from "@/hooks/pixelforge/use-pixelforge-run";
import type { ReferenceAnalysis } from "@/lib/pixelforge/schemas/analyze-reference";

export type VisualReferenceCoverage =
  | "static-visual-fullpage"
  | "static-visual-partial"
  | "semantic-only";

export interface VisualReferenceView {
  id: string;
  kind: "url" | "image" | "note";
  label: string;
  url?: string | null;
  assetUrl?: string | null;
  coverage: VisualReferenceCoverage;
  analysis: ReferenceAnalysis | null;
  weight: number;
  note?: string | null;
}

interface Props {
  projectId: string;
  references: VisualReferenceView[];
}

type AddTab = "url" | "image" | "note";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB — el server revalida (storage.ts), esto es solo UX.

// "static-visual-*" (no "visual-complete"): un screenshot NO prueba movimiento,
// estados ni comportamiento responsive — ver Gate 0 condición 4. El texto/tooltip
// deja esa limitación explícita en vez de sugerir cobertura total.
const COVERAGE_BADGE: Record<
  VisualReferenceCoverage,
  { label: string; className: string; tooltip: string }
> = {
  "static-visual-fullpage": {
    label: "Visual completa",
    className: "bg-lime-500/10 text-lime-700 dark:text-lime-300",
    tooltip:
      "Screenshot de la página completa: evidencia visual estática confiable, pero NO prueba movimiento, estados ni comportamiento responsive.",
  },
  "static-visual-partial": {
    label: "Visual parcial",
    className: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
    tooltip:
      "Screenshot de solo una parte del sitio: no representa la página completa y tampoco prueba movimiento/responsive.",
  },
  "semantic-only": {
    label: "Solo semántica",
    className: "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300",
    tooltip:
      "Sin screenshot: solo se analizó el contenido/estructura de la URL. No hay evidencia visual real todavía.",
  },
};

const KIND_ICON: Record<VisualReferenceView["kind"], typeof Link2> = {
  url: Link2,
  image: ImageIcon,
  note: StickyNote,
};

const ANALYSIS_LABELS: Record<keyof Omit<ReferenceAnalysis, "notas" | "personalidad">, string> = {
  densidadVisual: "Densidad",
  paletaDominante: "Paleta",
  temperatura: "Temperatura",
  tipografiaTitulos: "Tipografía",
  estiloLayout: "Layout",
  nivelMovimientoPercibido: "Movimiento",
};

const CHIP_CLASS =
  "rounded-full bg-secondary/40 px-2 py-0.5 text-[11px] text-muted-foreground";

/**
 * Estación Visual (F4): formularios de alta de referencias (url/imagen/nota)
 * + grid de cards con badge de cobertura, análisis IA por referencia y
 * eliminación. Calco estructural de `AddContextSourceForm` (formularios) +
 * `ContextBriefPanel`/`LandingDnaPanel` (patrón panel/estado). La síntesis del
 * Visual DNA vive en `VisualDnaPanel` (componente hermano).
 */
export function ReferenceGrid({ projectId, references }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<AddTab>("url");

  // URL form
  const [urlLabel, setUrlLabel] = useState("");
  const [url, setUrl] = useState("");
  const [urlBusy, setUrlBusy] = useState(false);

  // Image form
  const [imageLabel, setImageLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Note form
  const [noteLabel, setNoteLabel] = useState("");
  const [note, setNote] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);

  const submitUrl = async () => {
    if (urlLabel.trim().length === 0 || url.trim().length === 0 || urlBusy) return;
    setUrlBusy(true);
    const r = await addUrlReferenceAction({ projectId, label: urlLabel.trim(), url: url.trim() });
    setUrlBusy(false);
    if (!r.success) {
      toast.error(r.error ?? "No se pudo agregar la referencia");
      return;
    }
    toast.success("Referencia agregada");
    setUrlLabel("");
    setUrl("");
    router.refresh();
  };

  const submitImage = async () => {
    if (imageLabel.trim().length === 0 || !file || imageBusy) return;
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("La imagen excede 5MB");
      return;
    }
    setImageBusy(true);
    const formData = new FormData();
    formData.set("projectId", projectId);
    formData.set("label", imageLabel.trim());
    formData.set("file", file);
    const r = await addImageReferenceAction(formData);
    setImageBusy(false);
    if (!r.success) {
      toast.error(r.error ?? "No se pudo agregar la referencia");
      return;
    }
    toast.success("Referencia agregada");
    setImageLabel("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    router.refresh();
  };

  const submitNote = async () => {
    if (noteLabel.trim().length === 0 || note.trim().length === 0 || noteBusy) return;
    setNoteBusy(true);
    const r = await addNoteReferenceAction({ projectId, label: noteLabel.trim(), note: note.trim() });
    setNoteBusy(false);
    if (!r.success) {
      toast.error(r.error ?? "No se pudo agregar la nota");
      return;
    }
    toast.success("Referencia agregada");
    setNoteLabel("");
    setNote("");
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center gap-1 border-b border-border/60 text-sm">
          {(
            [
              { key: "url" as const, label: "URL", icon: Link2 },
              { key: "image" as const, label: "Imagen", icon: Upload },
              { key: "note" as const, label: "Nota", icon: StickyNote },
            ]
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 border-b-2 px-3 py-2 font-medium transition-colors ${
                tab === t.key
                  ? "border-cyan-400 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {tab === "url" && (
          <div className="space-y-3 pt-3">
            <div>
              <label
                htmlFor="ref-url-label"
                className="mb-1.5 block text-xs font-medium text-muted-foreground"
              >
                Etiqueta
              </label>
              <input
                id="ref-url-label"
                type="text"
                value={urlLabel}
                onChange={(e) => setUrlLabel(e.target.value)}
                placeholder="Ej. Sitio de la competencia"
                className="w-full rounded-md border border-border bg-secondary/40 px-3.5 py-2.5 text-sm text-foreground placeholder-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
              />
            </div>
            <div>
              <label
                htmlFor="ref-url-url"
                className="mb-1.5 block text-xs font-medium text-muted-foreground"
              >
                URL
              </label>
              <input
                id="ref-url-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://ejemplo.com"
                className="w-full rounded-md border border-border bg-secondary/40 px-3.5 py-2.5 text-sm text-foreground placeholder-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
              />
            </div>
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={submitUrl}
                disabled={urlLabel.trim().length === 0 || url.trim().length === 0 || urlBusy}
                className="flex items-center gap-2 rounded-md bg-cyan-500 px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-cyan-400 disabled:opacity-40"
              >
                {urlBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                {urlBusy ? "Descargando…" : "Agregar referencia"}
              </button>
            </div>
          </div>
        )}

        {tab === "image" && (
          <div className="space-y-3 pt-3">
            <div>
              <label
                htmlFor="ref-image-label"
                className="mb-1.5 block text-xs font-medium text-muted-foreground"
              >
                Etiqueta
              </label>
              <input
                id="ref-image-label"
                type="text"
                value={imageLabel}
                onChange={(e) => setImageLabel(e.target.value)}
                placeholder="Ej. Screenshot del hero actual"
                className="w-full rounded-md border border-border bg-secondary/40 px-3.5 py-2.5 text-sm text-foreground placeholder-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
              />
            </div>
            <div>
              <label
                htmlFor="ref-image-file"
                className="mb-1.5 block text-xs font-medium text-muted-foreground"
              >
                Imagen (PNG, JPEG o WebP, máx. 5MB)
              </label>
              <input
                id="ref-image-file"
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full rounded-md border border-border bg-secondary/40 px-3.5 py-2.5 text-sm text-foreground file:mr-3 file:rounded file:border-0 file:bg-cyan-500/20 file:px-2 file:py-1 file:text-xs file:text-cyan-700 dark:file:text-cyan-300 focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
              />
              {file && file.size > MAX_IMAGE_BYTES && (
                <p className="mt-1 text-[11px] text-red-500">La imagen excede 5MB.</p>
              )}
            </div>
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={submitImage}
                disabled={
                  imageLabel.trim().length === 0 ||
                  !file ||
                  file.size > MAX_IMAGE_BYTES ||
                  imageBusy
                }
                className="flex items-center gap-2 rounded-md bg-cyan-500 px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-cyan-400 disabled:opacity-40"
              >
                {imageBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {imageBusy ? "Subiendo…" : "Agregar referencia"}
              </button>
            </div>
          </div>
        )}

        {tab === "note" && (
          <div className="space-y-3 pt-3">
            <div>
              <label
                htmlFor="ref-note-label"
                className="mb-1.5 block text-xs font-medium text-muted-foreground"
              >
                Etiqueta
              </label>
              <input
                id="ref-note-label"
                type="text"
                value={noteLabel}
                onChange={(e) => setNoteLabel(e.target.value)}
                placeholder="Ej. Dirección que NO queremos"
                className="w-full rounded-md border border-border bg-secondary/40 px-3.5 py-2.5 text-sm text-foreground placeholder-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
              />
            </div>
            <div>
              <label
                htmlFor="ref-note-content"
                className="mb-1.5 block text-xs font-medium text-muted-foreground"
              >
                Nota
              </label>
              <textarea
                id="ref-note-content"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                placeholder="Describe el estilo, referencia o dirección que quieres capturar…"
                className="w-full resize-none rounded-md border border-border bg-secondary/40 px-3.5 py-3 text-sm text-foreground placeholder-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
              />
            </div>
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={submitNote}
                disabled={noteLabel.trim().length === 0 || note.trim().length === 0 || noteBusy}
                className="flex items-center gap-2 rounded-md bg-cyan-500 px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-cyan-400 disabled:opacity-40"
              >
                {noteBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <StickyNote className="h-4 w-4" />}
                Agregar referencia
              </button>
            </div>
          </div>
        )}
      </div>

      {references.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center">
          <FileText className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Agrega referencias visuales (sitios que admiras, screenshots, notas de estilo) para
            inspirar la dirección visual.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {references.map((reference) => (
            <ReferenceCard key={reference.id} projectId={projectId} reference={reference} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReferenceCard({
  projectId,
  reference,
}: {
  projectId: string;
  reference: VisualReferenceView;
}) {
  const router = useRouter();
  const [analyzeRunId, setAnalyzeRunId] = useState<string | null>(null);
  const [analyzeStarting, setAnalyzeStarting] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const { run } = usePixelforgeRun(analyzeRunId);
  const handledRunRef = useRef<string | null>(null);

  useEffect(() => {
    if (!run || !analyzeRunId || handledRunRef.current === analyzeRunId) return;
    if (run.status === "succeeded") {
      handledRunRef.current = analyzeRunId;
      toast.success("Referencia analizada");
      setAnalyzeRunId(null);
      router.refresh();
    } else if (run.status === "failed") {
      handledRunRef.current = analyzeRunId;
      const msg = run.error ?? "No se pudo analizar la referencia";
      setAnalyzeError(msg);
      toast.error(msg);
    }
  }, [run, analyzeRunId, router]);

  const isAnalyzing = analyzeStarting || (!!analyzeRunId && handledRunRef.current !== analyzeRunId);

  const startAnalysis = async () => {
    setAnalyzeStarting(true);
    setAnalyzeError(null);
    handledRunRef.current = null;
    try {
      const res = await fetch("/api/pixelforge/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          operation: "analyze_reference",
          referenceId: reference.id,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = json.error ?? "No se pudo iniciar el análisis";
        setAnalyzeError(msg);
        toast.error(msg);
        return;
      }
      // Contrato async igual que las otras operaciones: el resultado llega por
      // el poller (`usePixelforgeRun`), no en esta misma respuesta.
      setAnalyzeRunId(json.runId ?? null);
    } catch {
      const msg = "No se pudo iniciar el análisis";
      setAnalyzeError(msg);
      toast.error(msg);
    } finally {
      setAnalyzeStarting(false);
    }
  };

  const remove = async () => {
    if (removing) return;
    setRemoving(true);
    const r = await removeReferenceAction({ referenceId: reference.id });
    setRemoving(false);
    if (!r.success) {
      toast.error(r.error ?? "No se pudo eliminar la referencia");
      return;
    }
    toast.success("Referencia eliminada");
    router.refresh();
  };

  const Icon = KIND_ICON[reference.kind];
  const badge = COVERAGE_BADGE[reference.coverage];
  const suggestScreenshot = reference.coverage === "semantic-only" && reference.kind === "url";

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
      {reference.kind === "image" && reference.assetUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- thumbnail de un asset externo en R2, no vale la optimización de next/image acá.
        <img
          src={reference.assetUrl}
          alt={reference.label}
          className="h-32 w-full object-cover"
        />
      ) : (
        <div className="flex h-32 w-full items-center justify-center bg-secondary/30">
          <Icon className="h-8 w-8 text-muted-foreground" />
        </div>
      )}

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-foreground">{reference.label}</p>
          {!confirmingRemove ? (
            <button
              type="button"
              aria-label={`Quitar ${reference.label}`}
              onClick={() => setConfirmingRemove(true)}
              className="flex-shrink-0 text-muted-foreground transition-colors hover:text-red-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : (
            <div className="flex flex-shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={remove}
                disabled={removing}
                className="text-[11px] font-medium text-red-500 hover:text-red-400 disabled:opacity-40"
              >
                Confirmar
              </button>
              <button
                type="button"
                onClick={() => setConfirmingRemove(false)}
                className="text-[11px] text-muted-foreground hover:text-foreground"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>

        {reference.kind === "url" && reference.url && (
          <a
            href={reference.url}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate text-[11px] text-cyan-600 hover:underline dark:text-cyan-400"
          >
            {reference.url}
          </a>
        )}
        {reference.kind === "note" && reference.note && (
          <p className="line-clamp-3 text-xs text-muted-foreground">{reference.note}</p>
        )}

        <span
          title={badge.tooltip}
          className={`w-fit rounded px-1.5 py-0.5 text-[10px] font-medium ${badge.className}`}
        >
          {badge.label}
        </span>

        {suggestScreenshot && (
          <p className="text-[11px] text-muted-foreground/80">
            Sube un screenshot para análisis visual.
          </p>
        )}

        {reference.analysis ? (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {(Object.keys(ANALYSIS_LABELS) as (keyof typeof ANALYSIS_LABELS)[]).map((key) => (
              <span key={key} className={CHIP_CLASS}>
                {ANALYSIS_LABELS[key]}: {reference.analysis![key]}
              </span>
            ))}
            {reference.analysis.personalidad.map((p) => (
              <span key={p} className={CHIP_CLASS}>
                {p}
              </span>
            ))}
          </div>
        ) : (
          <div className="mt-1">
            {isAnalyzing ? (
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin text-cyan-400" />
                {run?.currentStep ?? "Analizando…"}
              </div>
            ) : (
              <button
                type="button"
                onClick={startAnalysis}
                className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:border-cyan-400/40 hover:text-cyan-500"
              >
                <Sparkles className="h-3 w-3" />
                Analizar
              </button>
            )}
            {!isAnalyzing && analyzeError && (
              <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                <AlertCircle className="h-3 w-3 flex-shrink-0" />
                {analyzeError}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
