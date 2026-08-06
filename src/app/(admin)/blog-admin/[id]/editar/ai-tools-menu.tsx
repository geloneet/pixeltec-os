"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import type { BlogPostEditInput } from "@/lib/blog/schemas";
import {
  improveTitle,
  improveExcerpt,
  improveFragment,
  adjustTone,
} from "@/lib/blog/actions/ai-tools";
import { BLOG_TONES, extractToneTarget, type BlogTone } from "@/lib/blog/ai-tools-logic";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const TONE_LABEL: Record<BlogTone, string> = {
  "técnico-directo": "Técnico directo",
  educativo: "Educativo",
  "opinión-defendida": "Opinión defendida",
  "caso-práctico": "Caso práctico",
};

type ProposalKind = "title" | "excerpt" | "fragment" | "tone";

interface Proposal {
  kind: ProposalKind;
  before: string;
  after: string;
  /** Solo fragment: rango de la selección dentro del body al momento de pedir. */
  selStart?: number;
  selEnd?: number;
  /** Solo tone: fin (exclusivo) de la introducción reemplazada en el body. */
  toneEnd?: number;
}

const PROPOSAL_TITLE: Record<ProposalKind, string> = {
  title: "Propuesta de título",
  excerpt: "Propuesta de extracto",
  fragment: "Propuesta para el fragmento seleccionado",
  tone: "Propuesta de introducción con tono corregido",
};

/** Lee la selección actual del textarea del cuerpo (etapa Escribir, B-PR4:
 *  vive dentro de #anchor-body). Devuelve null si no hay selección. */
function readBodySelection(): { start: number; end: number; text: string } | null {
  const textarea = document.querySelector<HTMLTextAreaElement>("#anchor-body textarea");
  if (!textarea) return null;
  const { selectionStart, selectionEnd, value } = textarea;
  if (selectionStart == null || selectionEnd == null || selectionStart === selectionEnd) return null;
  return { start: selectionStart, end: selectionEnd, text: value.slice(selectionStart, selectionEnd) };
}

interface AiToolsMenuProps {
  postId: string;
  form: UseFormReturn<BlogPostEditInput>;
  /** Regeneración completa (la action existente) — se dispara tras confirmar. */
  onRegenerate: () => void;
  disabled?: boolean;
  className?: string;
}

/**
 * B-PR6 — menú «Herramientas de IA» del sidebar del editor. Sustituye al botón
 * plano «Regenerar con IA»: las herramientas PROPONEN (Dialog Antes/Después,
 * el humano aplica o descarta — nada se escribe a la base); solo «Regenerar
 * artículo completo…» escribe, y ahora con confirmación + versión previa.
 */
export function AiToolsMenu({ postId, form, onRegenerate, disabled, className }: AiToolsMenuProps) {
  const [loading, setLoading] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [regenOpen, setRegenOpen] = useState(false);

  async function run(kind: ProposalKind, tone?: BlogTone) {
    setLoading(true);
    try {
      if (kind === "title") {
        const result = await improveTitle(postId);
        if (!result.ok || !result.data) return void toast.error(result.error ?? "Error");
        setProposal({ kind, before: form.getValues("title"), after: result.data.proposal });
      } else if (kind === "excerpt") {
        const result = await improveExcerpt(postId);
        if (!result.ok || !result.data) return void toast.error(result.error ?? "Error");
        setProposal({ kind, before: form.getValues("excerpt"), after: result.data.proposal });
      } else if (kind === "fragment") {
        const sel = readBodySelection();
        if (!sel) return void toast.error("Selecciona un fragmento en el cuerpo (etapa Escribir).");
        const result = await improveFragment(postId, sel.text);
        if (!result.ok || !result.data) return void toast.error(result.error ?? "Error");
        setProposal({
          kind,
          before: sel.text,
          after: result.data.proposal,
          selStart: sel.start,
          selEnd: sel.end,
        });
      } else if (kind === "tone" && tone) {
        const body = form.getValues("body");
        const { target, end } = extractToneTarget(body);
        const result = await adjustTone(postId, tone);
        if (!result.ok || !result.data) return void toast.error(result.error ?? "Error");
        setProposal({ kind, before: target, after: result.data.proposal, toneEnd: end });
      }
    } finally {
      setLoading(false);
    }
  }

  function applyProposal() {
    if (!proposal) return;
    if (proposal.kind === "title") {
      form.setValue("title", proposal.after, { shouldDirty: true });
    } else if (proposal.kind === "excerpt") {
      // El campo tiene tope duro de 160 en el schema — se recorta si la IA se pasó.
      form.setValue("excerpt", proposal.after.slice(0, 160), { shouldDirty: true });
    } else if (proposal.kind === "fragment") {
      const body = form.getValues("body");
      const { selStart = 0, selEnd = 0 } = proposal;
      // Si el cuerpo cambió desde que se pidió la propuesta, se re-localiza el
      // fragmento original; si ya no existe, no se aplica a ciegas.
      let start = selStart;
      let end = selEnd;
      if (body.slice(start, end) !== proposal.before) {
        const idx = body.indexOf(proposal.before);
        if (idx === -1) {
          toast.error("El fragmento original ya no está en el cuerpo — no se aplicó.");
          setProposal(null);
          return;
        }
        start = idx;
        end = idx + proposal.before.length;
      }
      form.setValue("body", body.slice(0, start) + proposal.after + body.slice(end), {
        shouldDirty: true,
      });
    } else if (proposal.kind === "tone") {
      const body = form.getValues("body");
      const { end } = extractToneTarget(body);
      form.setValue("body", proposal.after + body.slice(end), { shouldDirty: true });
    }
    toast.success("Propuesta aplicada — revisa y guarda cuando estés conforme.");
    setProposal(null);
  }

  return (
    <>
      <DropdownMenu
        onOpenChange={(open) => {
          // La selección se lee AL ABRIR: al hacer clic en el menú el textarea
          // pierde el foco, pero selectionStart/End se conservan.
          if (open) setHasSelection(readBodySelection() != null);
        }}
      >
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            disabled={disabled || loading}
            className={
              className ??
              "w-full border border-border bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-40"
            }
          >
            {loading ? <Spinner size="sm" className="mr-2" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Herramientas de IA
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuItem onSelect={() => void run("title")}>Mejorar título</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void run("excerpt")}>Reescribir extracto</DropdownMenuItem>
          <DropdownMenuItem disabled={!hasSelection} onSelect={() => void run("fragment")}>
            Mejorar fragmento seleccionado
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Corregir tono</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {BLOG_TONES.map((tone) => (
                <DropdownMenuItem key={tone} onSelect={() => void run("tone", tone)}>
                  {TONE_LABEL[tone]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-red-400 focus:text-red-300"
            onSelect={() => setRegenOpen(true)}
          >
            Regenerar artículo completo…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Propuesta Antes/Después — el humano decide, nada se escribió aún. */}
      <Dialog open={proposal != null} onOpenChange={(open) => !open && setProposal(null)}>
        <DialogContent className="max-w-2xl border-border bg-background text-foreground">
          <DialogHeader>
            <DialogTitle>{proposal ? PROPOSAL_TITLE[proposal.kind] : ""}</DialogTitle>
            <DialogDescription>
              Nada se ha guardado: aplica la propuesta al formulario o descártala.
            </DialogDescription>
          </DialogHeader>
          {proposal && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Antes
                </p>
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
                  {proposal.before || "(vacío)"}
                </pre>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Después
                </p>
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-green-500/30 bg-green-500/5 p-3 text-xs text-foreground">
                  {proposal.after}
                </pre>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setProposal(null)}
              className="border-border text-muted-foreground hover:bg-secondary"
            >
              Descartar
            </Button>
            <Button
              type="button"
              onClick={applyProposal}
              className="bg-blue-600 text-white hover:bg-blue-500"
            >
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Regenerar TODO: confirmación explícita — es la única herramienta que
          escribe a la base, y ahora guarda una versión previa (B-PR6). */}
      <AlertDialog open={regenOpen} onOpenChange={setRegenOpen}>
        <AlertDialogContent className="border-border bg-background text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">
              ¿Regenerar el artículo completo?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              La IA reescribirá título, extracto y cuerpo a partir del brief original.
              Antes de sobrescribir se guardará una versión con el contenido actual
              (podrás restaurarla desde «Historial de versiones» en la etapa Verificar).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border bg-secondary/50 text-foreground hover:bg-secondary">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setRegenOpen(false);
                onRegenerate();
              }}
              className="bg-red-600 text-white hover:bg-red-500"
            >
              Regenerar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
