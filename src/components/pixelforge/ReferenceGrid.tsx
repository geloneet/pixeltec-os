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
import { ForgeZone } from "@/components/pixelforge/forge/ForgeZone";
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
// deja esa limitación explícita en vez de sugerir cobertura total. Colores: éxito
// (fullpage) / aviso (parcial, DNA no tiene "medio" propio) / neutro (sin evidencia
// visual) — nada de cyan ni lima (prohibidos como acento de PixelForge).
const COVERAGE_BADGE: Record<
  VisualReferenceCoverage,
  { label: string; className: string; tooltip: string }
> = {
  "static-visual-fullpage": {
    label: "Visual completa",
    className: "bg-[hsl(var(--pfx-success)/0.12)] text-pfx-success",
    tooltip:
      "Screenshot de la página completa: evidencia visual estática confiable, pero NO prueba movimiento, estados ni comportamiento responsive.",
  },
  "static-visual-partial": {
    label: "Visual parcial",
    className: "bg-[hsl(var(--pfx-warning)/0.12)] text-pfx-warning",
    tooltip:
      "Screenshot de solo una parte del sitio: no representa la página completa y tampoco prueba movimiento/responsive.",
  },
  "semantic-only": {
    label: "Solo semántica",
    className: "bg-[hsl(var(--pfx-border)/0.5)] text-pfx-text-muted",
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

// Chip técnico (mono, DNA: "chips técnicos y números" → font-forge-mono).
const CHIP_CLASS =
  "rounded-full bg-[hsl(var(--pfx-border)/0.4)] px-2 py-0.5 font-forge-mono text-[10px] text-pfx-text-muted";

const INPUT_CLASS =
  "w-full rounded-[var(--pfx-radius)] border border-pfx-border bg-pfx-surface px-3.5 py-2.5 text-sm text-pfx-text placeholder:text-pfx-text-muted/60 focus:outline-none focus:ring-2 focus:ring-pfx-accent";

const SUBMIT_BUTTON_CLASS =
  "flex items-center gap-2 rounded-[var(--pfx-radius)] bg-pfx-accent px-4 py-2 text-sm font-medium text-pfx-on-accent transition-colors hover:bg-pfx-accent-strong disabled:opacity-40";

const FIELD_LABEL_CLASS = "mb-1.5 block text-xs font-medium text-pfx-text-muted";

/**
 * Estación Visual (F4 / reskin PF-X1 T6): formularios de alta de referencias
 * (url/imagen/nota) + grid de planchas con badge de cobertura, análisis IA
 * por referencia y eliminación. Las tabs del composer muestran la "veta
 * activa" (borde inferior cobre) de la pestaña seleccionada; cada referencia
 * es una `ForgeZone` cuyo estado es `forging` mientras se analiza (veta
 * fluyendo) y `draft` en reposo. La síntesis del Visual DNA vive en
 * `VisualDnaPanel` (componente hermano).
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
      <ForgeZone variant="elevated" className="p-5">
        <div className="mb-3 flex items-center gap-1 border-b border-pfx-border/60 text-sm">
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
                  ? "border-pfx-accent text-pfx-text"
                  : "border-transparent text-pfx-text-muted hover:text-pfx-text"
              }`}
            >
              <t.icon className="h-3.5 w-3.5" aria-hidden="true" />
              {t.label}
            </button>
          ))}
        </div>

        {tab === "url" && (
          <div className="space-y-3 pt-3">
            <div>
              <label htmlFor="ref-url-label" className={FIELD_LABEL_CLASS}>
                Etiqueta
              </label>
              <input
                id="ref-url-label"
                type="text"
                value={urlLabel}
                onChange={(e) => setUrlLabel(e.target.value)}
                placeholder="Ej. Sitio de la competencia"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor="ref-url-url" className={FIELD_LABEL_CLASS}>
                URL
              </label>
              <input
                id="ref-url-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://ejemplo.com"
                className={INPUT_CLASS}
              />
            </div>
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={submitUrl}
                disabled={urlLabel.trim().length === 0 || url.trim().length === 0 || urlBusy}
                className={SUBMIT_BUTTON_CLASS}
              >
                {urlBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Link2 className="h-4 w-4" aria-hidden="true" />
                )}
                {urlBusy ? "Descargando…" : "Agregar referencia"}
              </button>
            </div>
          </div>
        )}

        {tab === "image" && (
          <div className="space-y-3 pt-3">
            <div>
              <label htmlFor="ref-image-label" className={FIELD_LABEL_CLASS}>
                Etiqueta
              </label>
              <input
                id="ref-image-label"
                type="text"
                value={imageLabel}
                onChange={(e) => setImageLabel(e.target.value)}
                placeholder="Ej. Screenshot del hero actual"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor="ref-image-file" className={FIELD_LABEL_CLASS}>
                Imagen (PNG, JPEG o WebP, máx. 5MB)
              </label>
              <input
                id="ref-image-file"
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full rounded-[var(--pfx-radius)] border border-pfx-border bg-pfx-surface px-3.5 py-2.5 text-sm text-pfx-text file:mr-3 file:rounded file:border-0 file:bg-[hsl(var(--pfx-accent)/0.15)] file:px-2 file:py-1 file:text-xs file:text-pfx-accent focus:outline-none focus:ring-2 focus:ring-pfx-accent"
              />
              {file && file.size > MAX_IMAGE_BYTES && (
                <p className="mt-1 text-[11px] text-pfx-error">La imagen excede 5MB.</p>
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
                className={SUBMIT_BUTTON_CLASS}
              >
                {imageBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Upload className="h-4 w-4" aria-hidden="true" />
                )}
                {imageBusy ? "Subiendo…" : "Agregar referencia"}
              </button>
            </div>
          </div>
        )}

        {tab === "note" && (
          <div className="space-y-3 pt-3">
            <div>
              <label htmlFor="ref-note-label" className={FIELD_LABEL_CLASS}>
                Etiqueta
              </label>
              <input
                id="ref-note-label"
                type="text"
                value={noteLabel}
                onChange={(e) => setNoteLabel(e.target.value)}
                placeholder="Ej. Dirección que NO queremos"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor="ref-note-content" className={FIELD_LABEL_CLASS}>
                Nota
              </label>
              <textarea
                id="ref-note-content"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                placeholder="Describe el estilo, referencia o dirección que quieres capturar…"
                className={`resize-none ${INPUT_CLASS}`}
              />
            </div>
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={submitNote}
                disabled={noteLabel.trim().length === 0 || note.trim().length === 0 || noteBusy}
                className={SUBMIT_BUTTON_CLASS}
              >
                {noteBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <StickyNote className="h-4 w-4" aria-hidden="true" />
                )}
                Agregar referencia
              </button>
            </div>
          </div>
        )}
      </ForgeZone>

      {references.length === 0 ? (
        <ForgeZone variant="elevated" className="px-6 py-16 text-center">
          <FileText className="mx-auto mb-2 h-6 w-6 text-pfx-accent" aria-hidden="true" />
          <p className="text-sm text-pfx-text-muted">
            Agrega referencias visuales (sitios que admiras, screenshots, notas de estilo) para
            inspirar la dirección visual.
          </p>
        </ForgeZone>
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
    <ForgeZone
      state={isAnalyzing ? "forging" : "draft"}
      className="flex flex-col overflow-hidden"
    >
      {reference.kind === "image" && reference.assetUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- thumbnail de un asset externo en R2, no vale la optimización de next/image acá.
        <img
          src={reference.assetUrl}
          alt={reference.label}
          className="h-32 w-full object-cover"
        />
      ) : (
        <div className="flex h-32 w-full items-center justify-center bg-[hsl(var(--pfx-border)/0.25)]">
          <Icon className="h-8 w-8 text-pfx-text-muted" aria-hidden="true" />
        </div>
      )}

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-pfx-text">{reference.label}</p>
          {!confirmingRemove ? (
            <button
              type="button"
              aria-label={`Quitar ${reference.label}`}
              onClick={() => setConfirmingRemove(true)}
              className="flex-shrink-0 text-pfx-text-muted transition-colors hover:text-pfx-error"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : (
            <div className="flex flex-shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={remove}
                disabled={removing}
                className="text-[11px] font-medium text-pfx-error hover:opacity-80 disabled:opacity-40"
              >
                Confirmar
              </button>
              <button
                type="button"
                onClick={() => setConfirmingRemove(false)}
                className="text-[11px] text-pfx-text-muted hover:text-pfx-text"
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
            className="truncate text-[11px] text-pfx-accent hover:underline"
          >
            {reference.url}
          </a>
        )}
        {reference.kind === "note" && reference.note && (
          <p className="line-clamp-3 text-xs text-pfx-text-muted">{reference.note}</p>
        )}

        <span
          title={badge.tooltip}
          className={`w-fit rounded px-1.5 py-0.5 font-forge-mono text-[10px] font-medium ${badge.className}`}
        >
          {badge.label}
        </span>

        {suggestScreenshot && (
          <p className="text-[11px] text-pfx-text-muted/80">
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
              <div className="flex items-center gap-2 font-forge-mono text-[11px] uppercase tracking-wide text-pfx-text-muted">
                <Loader2 className="h-3 w-3 animate-spin text-pfx-accent" aria-hidden="true" />
                {run?.currentStep ?? "Analizando…"}
              </div>
            ) : (
              <button
                type="button"
                onClick={startAnalysis}
                className="flex items-center gap-1.5 rounded-[var(--pfx-radius)] border border-pfx-border px-2.5 py-1 text-[11px] font-medium text-pfx-text transition-colors hover:border-pfx-accent/40 hover:text-pfx-accent"
              >
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                Analizar
              </button>
            )}
            {!isAnalyzing && analyzeError && (
              <p className="mt-1 flex items-center gap-1 text-[11px] text-pfx-warning">
                <AlertCircle className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                {analyzeError}
              </p>
            )}
          </div>
        )}
      </div>
    </ForgeZone>
  );
}
