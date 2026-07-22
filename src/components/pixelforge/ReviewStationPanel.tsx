"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  FileEdit,
  Loader2,
  Lock,
  MessageSquare,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { computeQaGateState } from "@/lib/pixelforge/qa/gate-state";
import { computeReviewStage, isReleaseReady, type ReviewStage } from "@/lib/pixelforge/review/stage";
import { requiredRiskFindings } from "@/lib/pixelforge/review/approval-rules";
import { resolveChangeTarget, type ChangeKind } from "@/lib/pixelforge/review/target-station";
import { downstreamKinds, type PixelforgeArtifactKind, type PixelforgeStation } from "@/lib/pixelforge/types";
import { getStationMeta } from "@/lib/pixelforge/station-meta";
import { ForgeZone } from "@/components/pixelforge/forge/ForgeZone";
import { ForgeSeam } from "@/components/pixelforge/forge/ForgeSeam";
import { ForgeStamp } from "@/components/pixelforge/forge/ForgeStamp";
import { ForgeStationBadge } from "@/components/pixelforge/forge/ForgeStationBadge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { QaFindingView, QaRunView } from "@/components/pixelforge/QaStationPanel";

// ─── Vistas serializables (fechas ya en ISO — mismo criterio que
// `QaRunView`/`ProductionVersionView`: los `Date` de Drizzle se convierten a
// ISO ANTES de cruzar de `revision/page.tsx` (server) a este client
// component) ─────────────────────────────────────────────────────────────

export interface ReviewTreeNodeView {
  nodeId: string;
  componentId: string;
  orden: number;
}

export interface ReviewCommentView {
  id: string;
  reviewId: string;
  anchorType: "general" | "section" | "finding";
  nodeId: string | null;
  findingId: string | null;
  body: string;
  blocking: boolean;
  status: "open" | "resolved" | "dismissed" | "superseded";
  authorName: string;
  /** ISO. */
  createdAt: string;
  resolvedByName: string | null;
  /** ISO. */
  resolvedAt: string | null;
  resolutionReason: string | null;
}

export interface AcceptedRiskView {
  findingId: string;
  checkCode: string;
  severity: string;
  rationale: string;
  acceptedByName: string;
  /** ISO. */
  acceptedAt: string;
}

export interface ReviewView {
  id: string;
  pageVersionId: string;
  qaRunId: string;
  roundNumber: number;
  status: "in_review" | "changes_requested" | "approved" | "superseded" | "cancelled";
  verdictSnapshot: "pass" | "pass_with_warnings" | "fail";
  scoreSnapshot: number;
  targetStation: PixelforgeStation | null;
  requestReason: string | null;
  acceptedRisks: AcceptedRiskView[] | null;
  approvedByName: string | null;
  /** ISO. */
  approvedAt: string | null;
  approvalReason: string | null;
  openedByName: string;
  /** ISO. */
  createdAt: string;
  /** ISO. */
  closedAt: string | null;
}

export interface ReviewEventView {
  id: string;
  type: string;
  actorName: string;
  reason: string | null;
  /** ISO. */
  createdAt: string;
}

interface Props {
  projectId: string;
  /** La `page_version` vigente + metadata de composición, o `null` si el proyecto todavía no compone ninguna (gate de entrada `draft`). */
  currentPageVersion: {
    id: string;
    version: number;
    createdByName: string;
    /** ISO. */
    createdAt: string;
  } | null;
  /** TODAS las corridas de QA del proyecto — mismo shape que `QaStationPanel`, para recomputar el MISMO `gate` puro client-side. */
  runs: QaRunView[];
  /** TODAS las revisiones del proyecto, orden desc por `roundNumber` (tal como `listReviewsForProject`). */
  reviews: ReviewView[];
  /** TODOS los comentarios del proyecto (de cualquier ronda) — el panel filtra a la ronda visible. */
  comments: ReviewCommentView[];
  /** Findings del `qa_run` ANCLADO (`review.qaRunId` de la ronda visible, o `gate.currentVersionRun` si aún no hay ninguna review) — resuelto en `revision/page.tsx`. */
  anchoredRunFindings: QaFindingView[];
  /** Nodos del árbol de la vigente, para el ancla "sección" del alta de comentario. */
  treeNodes: ReviewTreeNodeView[];
  /** Eventos `station IN ('qa','revision')`, desc por fecha, límite 50 — resuelto en `revision/page.tsx`. */
  events: ReviewEventView[];
  /** true si el server detectó que la ronda `in_review` quedó anclada a un `qa_run` que ya no es el más reciente de su versión. */
  needsReanchor: boolean;
}

const MIN_REASON_LENGTH = 5;

/**
 * Duplicado deliberado de `VERDICT_DISPLAY` (`QaStationPanel.tsx`, NO
 * exportado de ahí — un import limpio no es posible sin tocar ese archivo,
 * fuera de alcance de T5) — mismo criterio documentado en ese componente
 * para `formatQaDate`/`formatSealedDate`.
 */
const VERDICT_DISPLAY: Record<
  "pass" | "pass_with_warnings" | "fail",
  { label: string; textClass: string; Icon: typeof CheckCircle2 }
> = {
  pass: { label: "TEMPLADA", textClass: "text-pfx-success", Icon: CheckCircle2 },
  pass_with_warnings: { label: "TEMPLADA CON RESERVAS", textClass: "text-pfx-warning", Icon: AlertTriangle },
  fail: { label: "QUEBRADIZA", textClass: "text-pfx-error", Icon: XCircle },
};

/** Labels es-MX de los `kindLabel` reales usados por cada `SealBar` de estación (ver `contexto|estrategia|visual|direcciones|blueprint/page.tsx`) — se reusa el MISMO texto para que "lo que se reabre" lea igual en toda la app. */
const ARTIFACT_KIND_LABEL: Record<PixelforgeArtifactKind, string> = {
  context_brief: "Context Brief",
  landing_dna: "Landing DNA",
  visual_dna: "Visual DNA",
  direction_decision: "Decisión de dirección",
  narrative_blueprint: "Blueprint narrativo",
};

const CHANGE_KIND_OPTIONS: { value: ChangeKind; label: string }[] = [
  { value: "contenido", label: "Contenido" },
  { value: "direccion_visual", label: "Dirección visual" },
  { value: "estructura", label: "Estructura / narrativa" },
  { value: "composicion", label: "Composición (recomponer)" },
  { value: "defecto_tecnico", label: "Defecto técnico (recomponer)" },
  { value: "defecto_registry", label: "Defecto de registry (bloqueo técnico)" },
];

const CONTENT_TARGET_OPTIONS: { value: "contexto" | "estrategia" | "blueprint"; label: string }[] = [
  { value: "contexto", label: "Contexto" },
  { value: "estrategia", label: "Estrategia" },
  { value: "blueprint", label: "Blueprint" },
];

const COMMENT_STATUS_OPTIONS: ReviewCommentView["status"][] = ["open", "resolved", "dismissed", "superseded"];
const COMMENT_STATUS_LABEL: Record<ReviewCommentView["status"], string> = {
  open: "Abierto",
  resolved: "Resuelto",
  dismissed: "Descartado",
  superseded: "Superseded",
};

const ANCHOR_TYPE_LABEL: Record<ReviewCommentView["anchorType"], string> = {
  general: "General",
  section: "Sección",
  finding: "Hallazgo",
};

/** Sentinel para el `Select` de ancla de filtro — Radix `Select` exige `value` siempre string (mismo criterio que `NONE_COMPARE` en `QaStationPanel.tsx`). */
const ANCHOR_FILTER_ALL = "all";

const EVENT_TYPE_LABEL: Record<string, string> = {
  qa_started: "QA iniciado",
  qa_finished: "QA finalizado",
  qa_failed: "QA fallido",
  qa_approved_with_warnings: "QA aprobado con reservas",
  qa_rejected: "QA rechazado",
  qa_gate_opened: "Compuerta a revisión abierta",
  review_opened: "Revisión abierta",
  comment_added: "Comentario agregado",
  comment_resolved: "Comentario resuelto",
  changes_requested: "Cambios solicitados",
  risk_accepted: "Riesgo aceptado",
  approval_granted: "Aprobación otorgada",
  approval_superseded: "Aprobación superseded",
  review_superseded: "Revisión superseded",
  review_cancelled: "Revisión cancelada",
};

function eventIcon(type: string): typeof CheckCircle2 {
  if (type === "approval_granted") return CheckCircle2;
  if (type === "qa_failed" || type === "qa_rejected") return XCircle;
  if (type === "comment_added" || type === "comment_resolved") return MessageSquare;
  if (type === "risk_accepted") return ShieldAlert;
  if (type === "changes_requested") return FileEdit;
  if (type === "approval_superseded" || type === "review_superseded" || type === "review_cancelled") return RotateCcw;
  return ShieldCheck;
}

/**
 * Formatea una fecha ISO a es-MX `dd mmm yyyy` — duplicado deliberado del
 * mismo criterio que `formatQaDate`/`formatVersionDate` (ver docstrings en
 * `QaStationPanel.tsx`/`ProductionPanel.tsx`: cada estación construye su
 * propia estampa mono, no reusa `ForgeStamp` fuera del caso "sellado").
 */
function formatReviewDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const day = new Intl.DateTimeFormat("es-MX", { day: "2-digit", timeZone: "UTC" }).format(date);
  const month = new Intl.DateTimeFormat("es-MX", { month: "short", timeZone: "UTC" })
    .format(date)
    .replace(/\.$/, "")
    .toLowerCase();
  const year = new Intl.DateTimeFormat("es-MX", { year: "numeric", timeZone: "UTC" }).format(date);
  return `${day} ${month} ${year}`;
}

const pfxSelectTriggerClass =
  "w-full rounded-[var(--pfx-radius)] border border-pfx-border bg-pfx-surface px-3 py-2 text-xs text-pfx-text focus:outline-none focus:ring-2 focus:ring-pfx-accent";
const pfxSelectContentClass = "border-pfx-border bg-pfx-surface-elevated text-pfx-text";
const pfxTextareaClass =
  "w-full resize-none rounded-[var(--pfx-radius)] border border-pfx-border bg-pfx-surface px-3 py-2 text-sm text-pfx-text placeholder:text-pfx-text-muted/60 focus:outline-none focus:ring-2 focus:ring-pfx-accent/40";
const pfxLabelClass = "mb-1.5 block text-xs font-medium text-pfx-text-muted";
const pfxCheckboxClass =
  "border-pfx-border data-[state=checked]:border-pfx-accent data-[state=checked]:bg-pfx-accent data-[state=checked]:text-pfx-on-accent";

/**
 * ReviewStationPanel — estación Revisión (PF-F9 T5). Mesa de decisión
 * vertical: la pieza (cabecera QA) arriba, el estado del ciclo, riesgos
 * aceptados, comentarios, timeline y, al pie, la zona de decisión humana
 * (aprobar / solicitar cambios / cancelar). NUNCA recomputa una regla
 * DISTINTA a la del dominio — `gate`/`stage`/`releaseReady` se derivan
 * SIEMPRE de los helpers puros de `gate-state.ts`/`review/stage.ts`, y la
 * validación de riesgos del checklist reusa `requiredRiskFindings`
 * (`review/approval-rules.ts`) — el server (`decision/route.ts`) es la
 * compuerta real, esto solo evita un roundtrip inútil.
 */
export function ReviewStationPanel({
  projectId,
  currentPageVersion,
  runs,
  reviews,
  comments,
  anchoredRunFindings,
  treeNodes,
  events,
  needsReanchor,
}: Props) {
  const router = useRouter();

  const gate = useMemo(
    () => computeQaGateState<QaRunView>(runs, currentPageVersion?.id ?? null),
    [runs, currentPageVersion?.id]
  );

  // La `in_review` si existe, si no la más reciente por `roundNumber` desc —
  // `reviews` YA llega en ese orden (`listReviewsForProject`).
  const activeOrLatestReview = useMemo(
    () => reviews.find((r) => r.status === "in_review") ?? reviews[0] ?? null,
    [reviews]
  );

  const stage: ReviewStage = useMemo(
    () => computeReviewStage(gate, activeOrLatestReview, currentPageVersion?.id ?? null),
    [gate, activeOrLatestReview, currentPageVersion?.id]
  );

  const releaseReady = useMemo(
    () => isReleaseReady(activeOrLatestReview, currentPageVersion?.id ?? null),
    [activeOrLatestReview, currentPageVersion?.id]
  );

  const reviewComments = useMemo(
    () => comments.filter((c) => c.reviewId === activeOrLatestReview?.id),
    [comments, activeOrLatestReview?.id]
  );

  const blockingOpenComments = useMemo(
    () => reviewComments.filter((c) => c.blocking && c.status === "open"),
    [reviewComments]
  );

  const treeNodeLabel = useMemo(() => {
    const byId = new Map(treeNodes.map((n) => [n.nodeId, `${n.componentId} · orden ${n.orden}`]));
    return (nodeId: string | null) => (nodeId ? byId.get(nodeId) ?? nodeId : null);
  }, [treeNodes]);

  const findingById = useMemo(() => new Map(anchoredRunFindings.map((f) => [f.id, f])), [anchoredRunFindings]);

  // ─── B: error genérico de POST en la zona de decisión ───────────────────
  const [decisionError, setDecisionError] = useState<string | null>(null);

  // ─── B: abrir revisión (ready_for_review) ────────────────────────────────
  const [openBusy, setOpenBusy] = useState(false);

  const openReview = async () => {
    if (openBusy) return;
    setOpenBusy(true);
    try {
      const res = await fetch("/api/pixelforge/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setDecisionError(json.error ?? "No se pudo abrir la revisión");
        return;
      }
      router.refresh();
    } catch {
      setDecisionError("No se pudo abrir la revisión");
    } finally {
      setOpenBusy(false);
    }
  };

  // ─── F: re-anclar ─────────────────────────────────────────────────────────
  const [reanchorBusy, setReanchorBusy] = useState(false);

  const reanchor = async () => {
    if (reanchorBusy || !activeOrLatestReview) return;
    setReanchorBusy(true);
    try {
      const res = await fetch(`/api/pixelforge/reviews/${activeOrLatestReview.id}/reanchor`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setDecisionError(json.error ?? "No se pudo re-anclar la revisión");
        return;
      }
      router.refresh();
    } catch {
      setDecisionError("No se pudo re-anclar la revisión");
    } finally {
      setReanchorBusy(false);
    }
  };

  // ─── D: alta de comentario ────────────────────────────────────────────────
  const [commentAnchorType, setCommentAnchorType] = useState<ReviewCommentView["anchorType"]>("general");
  const [commentNodeId, setCommentNodeId] = useState<string | null>(null);
  const [commentFindingId, setCommentFindingId] = useState<string | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [commentBlocking, setCommentBlocking] = useState(false);
  const [commentBusy, setCommentBusy] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  const commentAnchorValid =
    commentAnchorType === "general" ||
    (commentAnchorType === "section" && !!commentNodeId) ||
    (commentAnchorType === "finding" && !!commentFindingId);
  const commentValid = commentAnchorValid && commentBody.trim().length > 0;

  const submitComment = async () => {
    if (!commentValid || commentBusy || !activeOrLatestReview) return;
    setCommentBusy(true);
    setCommentError(null);
    try {
      const body: Record<string, unknown> = {
        anchorType: commentAnchorType,
        body: commentBody.trim(),
        blocking: commentBlocking,
      };
      if (commentAnchorType === "section" && commentNodeId) body.nodeId = commentNodeId;
      if (commentAnchorType === "finding" && commentFindingId) body.findingId = commentFindingId;

      const res = await fetch(`/api/pixelforge/reviews/${activeOrLatestReview.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setCommentError(json.error ?? "No se pudo agregar el comentario");
        return;
      }
      setCommentBody("");
      setCommentNodeId(null);
      setCommentFindingId(null);
      setCommentAnchorType("general");
      setCommentBlocking(false);
      router.refresh();
    } catch {
      setCommentError("No se pudo agregar el comentario");
    } finally {
      setCommentBusy(false);
    }
  };

  // ─── D: filtros de comentarios ────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState<Set<ReviewCommentView["status"]>>(
    () => new Set(COMMENT_STATUS_OPTIONS)
  );
  const [anchorFilter, setAnchorFilter] = useState<string>(ANCHOR_FILTER_ALL);

  const toggleStatusFilter = (s: ReviewCommentView["status"]) => {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const visibleComments = useMemo(() => {
    const filtered = reviewComments.filter(
      (c) => statusFilter.has(c.status) && (anchorFilter === ANCHOR_FILTER_ALL || c.anchorType === anchorFilter)
    );
    const byDateDesc = (a: ReviewCommentView, b: ReviewCommentView) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    const blockingOpen = filtered.filter((c) => c.blocking && c.status === "open").sort(byDateDesc);
    const rest = filtered.filter((c) => !(c.blocking && c.status === "open")).sort(byDateDesc);
    return [...blockingOpen, ...rest];
  }, [reviewComments, statusFilter, anchorFilter]);

  // ─── D: resolver/descartar ────────────────────────────────────────────────
  const [resolvingComment, setResolvingComment] = useState<ReviewCommentView | null>(null);
  const [resolutionFinalStatus, setResolutionFinalStatus] = useState<"resolved" | "dismissed">("resolved");
  const [resolutionReason, setResolutionReason] = useState("");
  const [resolutionBusy, setResolutionBusy] = useState(false);
  const [resolutionError, setResolutionError] = useState<string | null>(null);

  const openResolution = (comment: ReviewCommentView, finalStatus: "resolved" | "dismissed") => {
    setResolvingComment(comment);
    setResolutionFinalStatus(finalStatus);
    setResolutionReason("");
    setResolutionError(null);
  };

  const submitResolution = async () => {
    if (!resolvingComment || resolutionReason.trim().length < MIN_REASON_LENGTH || resolutionBusy) return;
    setResolutionBusy(true);
    try {
      const res = await fetch(
        `/api/pixelforge/reviews/${resolvingComment.reviewId}/comments/${resolvingComment.id}/resolution`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ finalStatus: resolutionFinalStatus, reason: resolutionReason.trim() }),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        setResolutionError(json.error ?? "No se pudo resolver el comentario");
        return;
      }
      setResolvingComment(null);
      router.refresh();
    } catch {
      setResolutionError("No se pudo resolver el comentario");
    } finally {
      setResolutionBusy(false);
    }
  };

  // ─── F: solicitar cambios ─────────────────────────────────────────────────
  const [rcOpen, setRcOpen] = useState(false);
  const [rcChangeKind, setRcChangeKind] = useState<ChangeKind>("contenido");
  const [rcContentTarget, setRcContentTarget] = useState<"contexto" | "estrategia" | "blueprint" | null>(null);
  const [rcReason, setRcReason] = useState("");
  const [rcBusy, setRcBusy] = useState(false);

  const rcTarget = useMemo(() => {
    try {
      return resolveChangeTarget(rcChangeKind, rcChangeKind === "contenido" ? (rcContentTarget ?? undefined) : undefined);
    } catch {
      return null;
    }
  }, [rcChangeKind, rcContentTarget]);

  const rcDownstream = useMemo(() => {
    if (!rcTarget || rcTarget.mechanism !== "reopen_artifact" || !rcTarget.artifactKind) return [];
    return downstreamKinds(rcTarget.artifactKind);
  }, [rcTarget]);

  const rcValid =
    !!rcTarget && rcReason.trim().length >= MIN_REASON_LENGTH && blockingOpenComments.length === 0;

  const openRequestChanges = () => {
    setRcOpen(true);
    setRcChangeKind("contenido");
    setRcContentTarget(null);
    setRcReason("");
    setDecisionError(null);
  };

  const submitRequestChanges = async () => {
    if (!rcValid || rcBusy || !activeOrLatestReview) return;
    setRcBusy(true);
    setDecisionError(null);
    try {
      const body: Record<string, unknown> = {
        action: "request_changes",
        changeKind: rcChangeKind,
        reason: rcReason.trim(),
      };
      if (rcChangeKind === "contenido" && rcContentTarget) body.contentTarget = rcContentTarget;

      const res = await fetch(`/api/pixelforge/reviews/${activeOrLatestReview.id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setDecisionError(json.error ?? "No se pudo solicitar el cambio");
        return;
      }
      setRcOpen(false);
      router.refresh();
    } catch {
      setDecisionError("No se pudo solicitar el cambio");
    } finally {
      setRcBusy(false);
    }
  };

  // ─── F: aprobar ───────────────────────────────────────────────────────────
  const [apOpen, setApOpen] = useState(false);
  const [apReason, setApReason] = useState("");
  const [apChecked, setApChecked] = useState<Set<string>>(new Set());
  const [apRationale, setApRationale] = useState<Record<string, string>>({});
  const [apBusy, setApBusy] = useState(false);

  // `requiredRiskFindings` (dominio, `approval-rules.ts`) devuelve `FindingLike[]`
  // (sin `title`) — se llama IGUAL para decidir CUÁLES ids son obligatorios
  // (nunca se reimplementa esa regla acá) y se re-joinea contra
  // `anchoredRunFindings` (la vista completa) solo para tener `title` al
  // renderizar el checklist.
  const requiredMajorIds = useMemo(
    () =>
      new Set(
        activeOrLatestReview ? requiredRiskFindings(activeOrLatestReview.verdictSnapshot, anchoredRunFindings).map((f) => f.id) : []
      ),
    [activeOrLatestReview, anchoredRunFindings]
  );
  const apMajors = useMemo(
    () => anchoredRunFindings.filter((f) => requiredMajorIds.has(f.id)),
    [anchoredRunFindings, requiredMajorIds]
  );
  const apMinors = useMemo(() => anchoredRunFindings.filter((f) => f.severity === "minor"), [anchoredRunFindings]);
  const apBlocking = useMemo(() => anchoredRunFindings.filter((f) => f.blocking), [anchoredRunFindings]);
  const apChecklistItems = useMemo(() => [...apMajors, ...apMinors], [apMajors, apMinors]);
  const needsChecklist = activeOrLatestReview?.verdictSnapshot === "pass_with_warnings";

  const toggleApChecked = (id: string) => {
    setApChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const apCheckedEntries = apChecklistItems.filter((f) => apChecked.has(f.id));
  const apAnyCheckedInvalid = apCheckedEntries.some((f) => (apRationale[f.id] ?? "").trim().length < MIN_REASON_LENGTH);
  const apMajorsCovered = apMajors.every(
    (f) => apChecked.has(f.id) && (apRationale[f.id] ?? "").trim().length >= MIN_REASON_LENGTH
  );

  const apValid =
    apReason.trim().length >= MIN_REASON_LENGTH &&
    apBlocking.length === 0 &&
    blockingOpenComments.length === 0 &&
    (!needsChecklist || (apMajorsCovered && !apAnyCheckedInvalid));

  const openApprove = () => {
    setApOpen(true);
    setApReason("");
    setApChecked(new Set());
    setApRationale({});
    setDecisionError(null);
  };

  const submitApprove = async () => {
    if (!apValid || apBusy || !activeOrLatestReview) return;
    setApBusy(true);
    setDecisionError(null);
    try {
      const risks = apCheckedEntries.map((f) => ({ findingId: f.id, rationale: (apRationale[f.id] ?? "").trim() }));
      const res = await fetch(`/api/pixelforge/reviews/${activeOrLatestReview.id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", reason: apReason.trim(), risks }),
      });
      const json = await res.json();
      if (!res.ok) {
        setDecisionError(json.error ?? "No se pudo aprobar la revisión");
        return;
      }
      setApOpen(false);
      router.refresh();
    } catch {
      setDecisionError("No se pudo aprobar la revisión");
    } finally {
      setApBusy(false);
    }
  };

  // ─── F: cancelar ──────────────────────────────────────────────────────────
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);

  const submitCancel = async () => {
    if (cancelReason.trim().length < MIN_REASON_LENGTH || cancelBusy || !activeOrLatestReview) return;
    setCancelBusy(true);
    setDecisionError(null);
    try {
      const res = await fetch(`/api/pixelforge/reviews/${activeOrLatestReview.id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", reason: cancelReason.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setDecisionError(json.error ?? "No se pudo cancelar la revisión");
        return;
      }
      setCancelOpen(false);
      router.refresh();
    } catch {
      setDecisionError("No se pudo cancelar la revisión");
    } finally {
      setCancelBusy(false);
    }
  };

  // ─── Gate de entrada: sin page_version vigente ───────────────────────────
  if (!currentPageVersion) {
    return (
      <ForgeZone variant="elevated" state="locked" className="px-6 py-16 text-center">
        <Lock className="mx-auto mb-3 h-6 w-6 text-pfx-forge-locked" aria-hidden="true" />
        <p className="text-sm font-medium text-pfx-text">Aún no hay versión compuesta</p>
        <p className="mt-1 text-xs text-pfx-text-muted">Compón la landing en Producción antes de revisar.</p>
        <Link
          href={`/proyectos/pixelforge/${projectId}/produccion`}
          className="mx-auto mt-4 inline-flex items-center gap-2 rounded-[var(--pfx-radius)] bg-pfx-accent px-4 py-2 text-sm font-medium text-pfx-on-accent transition-colors hover:bg-pfx-accent-strong"
        >
          Ir a Producción
        </Link>
      </ForgeZone>
    );
  }

  // Verdict/score de cabecera: el snapshot de la review visible si existe, si no el run cerrado de la vigente (mismo dato que `QaStationPanel` llama "Temple").
  const headerVerdict = activeOrLatestReview?.verdictSnapshot ?? gate.currentVersionRun?.verdict ?? null;
  const headerScore = activeOrLatestReview?.scoreSnapshot ?? gate.currentVersionRun?.scoreTotal ?? null;
  const blockingFindingCount = anchoredRunFindings.filter((f) => f.blocking || f.severity === "critical").length;
  const warningFindingCount = anchoredRunFindings.filter((f) => f.severity === "major" || f.severity === "minor").length;

  return (
    <div className="space-y-4">
      {/* ─── A. Cabecera de la pieza ────────────────────────────────────── */}
      <ForgeZone variant="elevated" state="sealed" className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {headerVerdict && (
                <>
                  {(() => {
                    const display = VERDICT_DISPLAY[headerVerdict];
                    const Icon = display.Icon;
                    return (
                      <span
                        className={`inline-flex items-center gap-1.5 font-forge-mono text-[11px] font-semibold uppercase tracking-[0.18em] ${display.textClass}`}
                      >
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                        {display.label}
                      </span>
                    );
                  })()}
                </>
              )}
              <span className="font-forge-mono text-sm font-bold text-pfx-text">v{currentPageVersion.version}</span>
              <span className="font-forge-mono text-[11px] uppercase tracking-[0.14em] text-pfx-text-muted">
                {formatReviewDate(currentPageVersion.createdAt)} · {currentPageVersion.createdByName}
              </span>
            </div>
            {headerScore !== null && (
              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-forge-mono text-3xl font-extrabold text-pfx-text">{headerScore}</span>
                <span className="text-xs text-pfx-text-muted">/ 100</span>
              </div>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-pfx-text-muted">
              <span>{blockingFindingCount} bloqueantes</span>
              <span>{warningFindingCount} advertencias</span>
            </div>
          </div>

          <div className="flex flex-shrink-0 flex-col items-end gap-2 text-xs">
            <Link
              href={`/proyectos/pixelforge/${projectId}/qa`}
              className="text-pfx-accent transition-colors hover:underline"
            >
              Ver QA completo
            </Link>
            <a
              href={`/proyectos/pixelforge/${projectId}/preview`}
              target="_blank"
              rel="noreferrer"
              className="rounded-[var(--pfx-radius)] border border-pfx-border px-3 py-1.5 font-medium text-pfx-text transition-colors hover:border-pfx-accent/40 hover:text-pfx-accent"
            >
              Abrir preview
            </a>
          </div>
        </div>
      </ForgeZone>

      {/* ─── B. Estado del ciclo ─────────────────────────────────────────── */}
      <StageBanner
        stage={stage}
        projectId={projectId}
        currentVersion={currentPageVersion.version}
        gateReason={gate.reason}
        review={activeOrLatestReview}
        releaseReady={releaseReady}
        onOpenReview={openReview}
        openBusy={openBusy}
      />

      {activeOrLatestReview?.status === "superseded" && (
        <div className="flex items-start gap-2 rounded-[var(--pfx-radius)] border border-pfx-border bg-pfx-surface px-3 py-2.5 text-xs text-pfx-text-muted">
          <RotateCcw className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          La aprobación quedó superseded por v{currentPageVersion.version}.
        </div>
      )}
      {activeOrLatestReview?.status === "cancelled" && (
        <div className="flex items-start gap-2 rounded-[var(--pfx-radius)] border border-pfx-border bg-pfx-surface px-3 py-2.5 text-xs text-pfx-text-muted">
          <RotateCcw className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          Ronda {activeOrLatestReview.roundNumber} cancelada — {activeOrLatestReview.requestReason}
        </div>
      )}

      {/* ─── C. Riesgos aceptados ────────────────────────────────────────── */}
      {activeOrLatestReview?.acceptedRisks && activeOrLatestReview.acceptedRisks.length > 0 && (
        <ForgeZone state="sealed" className="p-4">
          <p className="mb-3 text-sm font-medium text-pfx-text">Riesgos aceptados</p>
          <ul>
            {activeOrLatestReview.acceptedRisks.map((r, i) => (
              <li key={r.findingId}>
                {i > 0 && <ForgeSeam className="my-2" />}
                <div className="py-1.5 text-xs">
                  <span className="font-forge-mono font-semibold text-pfx-text">{r.checkCode}</span>{" "}
                  <span className="text-pfx-text-muted">· {r.severity}</span>
                  <p className="mt-0.5 text-pfx-text">{r.rationale}</p>
                  <p className="mt-0.5 text-[11px] text-pfx-text-muted">
                    {r.acceptedByName} · {formatReviewDate(r.acceptedAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </ForgeZone>
      )}

      {/* ─── D. Comentarios ──────────────────────────────────────────────── */}
      <ForgeZone state="sealed" className="p-4">
        <p className="mb-3 text-sm font-medium text-pfx-text">Comentarios</p>

        {stage === "in_review" && (
          <div className="mb-4 space-y-2 border-b border-pfx-border pb-4">
            <div className="flex flex-wrap gap-2">
              <div className="w-40">
                <Select
                  value={commentAnchorType}
                  onValueChange={(v) => {
                    setCommentAnchorType(v as ReviewCommentView["anchorType"]);
                    setCommentNodeId(null);
                    setCommentFindingId(null);
                  }}
                >
                  <SelectTrigger aria-label="Ancla del comentario" className={pfxSelectTriggerClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={pfxSelectContentClass} data-product="pixelforge">
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="section">Sección</SelectItem>
                    <SelectItem value="finding">Hallazgo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {commentAnchorType === "section" && (
                <div className="w-56">
                  <Select value={commentNodeId ?? ""} onValueChange={(v) => setCommentNodeId(v)}>
                    <SelectTrigger aria-label="Nodo" className={pfxSelectTriggerClass}>
                      <SelectValue placeholder="Elige un nodo…" />
                    </SelectTrigger>
                    <SelectContent className={pfxSelectContentClass} data-product="pixelforge">
                      {treeNodes.map((n) => (
                        <SelectItem key={n.nodeId} value={n.nodeId}>
                          {n.componentId} · orden {n.orden}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {commentAnchorType === "finding" && (
                <div className="w-72">
                  <Select value={commentFindingId ?? ""} onValueChange={(v) => setCommentFindingId(v)}>
                    <SelectTrigger aria-label="Hallazgo" className={pfxSelectTriggerClass}>
                      <SelectValue placeholder="Elige un hallazgo…" />
                    </SelectTrigger>
                    <SelectContent className={pfxSelectContentClass} data-product="pixelforge">
                      {anchoredRunFindings.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.checkCode} — {f.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <textarea
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              rows={2}
              placeholder="Escribe tu comentario…"
              className={pfxTextareaClass}
            />

            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-xs text-pfx-text-muted">
                <Checkbox
                  checked={commentBlocking}
                  onCheckedChange={(v) => setCommentBlocking(v === true)}
                  className={pfxCheckboxClass}
                  aria-label="Bloqueante"
                />
                Bloqueante
              </label>
              <button
                type="button"
                onClick={submitComment}
                disabled={!commentValid || commentBusy}
                className="flex items-center gap-1.5 rounded-[var(--pfx-radius)] bg-pfx-accent px-3 py-1.5 text-xs font-medium text-pfx-on-accent transition-colors hover:bg-pfx-accent-strong disabled:opacity-40"
              >
                {commentBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                Agregar comentario
              </button>
            </div>
            {commentError && <p className="text-xs text-pfx-error">{commentError}</p>}
          </div>
        )}

        <div className="mb-3 flex flex-wrap items-center gap-2">
          {COMMENT_STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggleStatusFilter(s)}
              aria-pressed={statusFilter.has(s)}
              aria-label={`Filtrar estado ${COMMENT_STATUS_LABEL[s]}`}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                statusFilter.has(s)
                  ? "border-pfx-accent/50 bg-[hsl(var(--pfx-accent)/0.12)] text-pfx-accent"
                  : "border-pfx-border bg-transparent text-pfx-text-muted/60 hover:text-pfx-text-muted"
              }`}
            >
              {COMMENT_STATUS_LABEL[s]}
            </button>
          ))}
          <div className="ml-auto w-40">
            <Select value={anchorFilter} onValueChange={setAnchorFilter}>
              <SelectTrigger aria-label="Filtrar por ancla" className={pfxSelectTriggerClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={pfxSelectContentClass} data-product="pixelforge">
                <SelectItem value={ANCHOR_FILTER_ALL}>Todas las anclas</SelectItem>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="section">Sección</SelectItem>
                <SelectItem value="finding">Hallazgo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {visibleComments.length === 0 ? (
          <p className="py-6 text-center text-xs text-pfx-text-muted">Sin comentarios con estos filtros.</p>
        ) : (
          <ul>
            {visibleComments.map((c, i) => {
              const isOpen = c.status === "open";
              const anchorLabel =
                c.anchorType === "general"
                  ? "General"
                  : c.anchorType === "section"
                    ? treeNodeLabel(c.nodeId) ?? "Sección"
                    : (() => {
                        const f = c.findingId ? findingById.get(c.findingId) : undefined;
                        return f ? `${f.checkCode} — ${f.title}` : "Hallazgo";
                      })();
              return (
                <li key={c.id}>
                  {i > 0 && <ForgeSeam className="my-2" />}
                  <div className="py-1.5 text-xs">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {c.blocking && isOpen && (
                        <span className="rounded-full border border-pfx-error/40 bg-[hsl(var(--pfx-error)/0.1)] px-1.5 py-0.5 font-forge-mono text-[10px] uppercase tracking-wide text-pfx-error">
                          bloqueante
                        </span>
                      )}
                      <span className="font-forge-mono text-[10px] uppercase tracking-wide text-pfx-text-muted">
                        {ANCHOR_TYPE_LABEL[c.anchorType]}
                        {anchorLabel !== ANCHOR_TYPE_LABEL[c.anchorType] ? ` · ${anchorLabel}` : ""}
                      </span>
                    </div>
                    <p className="mt-0.5 text-pfx-text">{c.body}</p>
                    <p className="mt-0.5 text-[11px] text-pfx-text-muted">
                      {c.authorName} · {formatReviewDate(c.createdAt)}
                    </p>
                    {isOpen ? (
                      <div className="mt-1.5 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => openResolution(c, "resolved")}
                          className="text-[11px] font-medium text-pfx-accent hover:underline"
                        >
                          Resolver
                        </button>
                        <button
                          type="button"
                          onClick={() => openResolution(c, "dismissed")}
                          className="text-[11px] font-medium text-pfx-text-muted hover:text-pfx-text hover:underline"
                        >
                          Descartar
                        </button>
                      </div>
                    ) : (
                      c.resolvedByName && (
                        <p className="mt-0.5 text-[11px] text-pfx-text-muted">
                          {COMMENT_STATUS_LABEL[c.status]} por {c.resolvedByName}
                          {c.resolvedAt && ` · ${formatReviewDate(c.resolvedAt)}`}
                          {c.resolutionReason && ` — "${c.resolutionReason}"`}
                        </p>
                      )
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </ForgeZone>

      {/* ─── E. Timeline ─────────────────────────────────────────────────── */}
      <ForgeZone state="sealed" className="p-4">
        <p className="mb-3 text-sm font-medium text-pfx-text">Historial</p>
        {events.length === 0 ? (
          <p className="py-4 text-center text-xs text-pfx-text-muted">Sin eventos todavía.</p>
        ) : (
          <ul>
            {events.map((e, i) => {
              const Icon = eventIcon(e.type);
              return (
                <li key={e.id}>
                  {i > 0 && <ForgeSeam className="my-2" />}
                  <div className="flex items-start gap-2 py-1 text-xs">
                    <Icon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-pfx-text-muted" aria-hidden="true" />
                    <div>
                      <span className="font-medium text-pfx-text">{EVENT_TYPE_LABEL[e.type] ?? e.type}</span>{" "}
                      <span className="text-pfx-text-muted">
                        · {e.actorName} · {formatReviewDate(e.createdAt)}
                      </span>
                      {e.reason && <p className="mt-0.5 text-pfx-text-muted">{`"${e.reason}"`}</p>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </ForgeZone>

      {/* ─── F. Zona de decisión ─────────────────────────────────────────── */}
      {stage === "in_review" && activeOrLatestReview && (
        <ForgeZone variant="elevated" state="draft" className="p-4">
          {needsReanchor && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-[var(--pfx-radius)] border border-pfx-warning/30 bg-[hsl(var(--pfx-warning)/0.08)] px-3 py-2.5 text-xs text-pfx-warning">
              <span className="flex items-center gap-2">
                <RotateCcw className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                Hay un QA más reciente sobre esta versión.
              </span>
              <button
                type="button"
                onClick={reanchor}
                disabled={reanchorBusy}
                className="flex items-center gap-1.5 rounded-[var(--pfx-radius)] border border-pfx-warning/40 bg-[hsl(var(--pfx-warning)/0.12)] px-3 py-1.5 font-medium text-pfx-warning transition-colors hover:bg-[hsl(var(--pfx-warning)/0.2)] disabled:opacity-40"
              >
                {reanchorBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                Re-anclar al QA más reciente
              </button>
            </div>
          )}

          {blockingOpenComments.length > 0 && (
            <div className="mb-3 rounded-[var(--pfx-radius)] border border-pfx-error/30 bg-[hsl(var(--pfx-error)/0.08)] px-3 py-2.5 text-xs text-pfx-error">
              <p className="font-medium">
                Hay {blockingOpenComments.length} comentario(s) bloqueante(s) sin resolver:
              </p>
              <ul className="mt-1 list-inside list-disc">
                {blockingOpenComments.map((c) => (
                  <li key={c.id}>{c.body}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openRequestChanges}
              disabled={blockingOpenComments.length > 0}
              className="flex items-center gap-1.5 rounded-[var(--pfx-radius)] border border-pfx-border px-3 py-1.5 text-xs font-medium text-pfx-text transition-colors hover:border-pfx-warning/40 hover:text-pfx-warning disabled:cursor-not-allowed disabled:opacity-40"
            >
              <FileEdit className="h-3.5 w-3.5" aria-hidden="true" />
              Solicitar cambios
            </button>
            <button
              type="button"
              onClick={openApprove}
              disabled={blockingOpenComments.length > 0}
              className="flex items-center gap-1.5 rounded-[var(--pfx-radius)] bg-pfx-accent px-3 py-1.5 text-xs font-medium text-pfx-on-accent transition-colors hover:bg-pfx-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Aprobar
            </button>
            <button
              type="button"
              onClick={() => {
                setCancelOpen(true);
                setCancelReason("");
                setDecisionError(null);
              }}
              className="ml-auto text-xs text-pfx-text-muted hover:text-pfx-error hover:underline"
            >
              Cancelar revisión
            </button>
          </div>

          {decisionError && <p className="mt-2 text-xs text-pfx-error">{decisionError}</p>}
        </ForgeZone>
      )}

      {/* ─── Dialogs — cada `SelectContent`/`DialogContent` (Radix Portal)
          renderiza en `document.body`, fuera de `[data-product="pixelforge"]`
          — se re-declara el atributo directo (mismo patrón X1-T3 que
          `QaStationPanel.tsx`). ────────────────────────────────────────── */}

      <Dialog open={!!resolvingComment} onOpenChange={(open) => !open && setResolvingComment(null)}>
        <DialogContent className="border-pfx-border bg-pfx-surface text-pfx-text" data-product="pixelforge">
          <DialogHeader>
            <DialogTitle>{resolutionFinalStatus === "resolved" ? "Resolver comentario" : "Descartar comentario"}</DialogTitle>
          </DialogHeader>
          <div>
            <label htmlFor="resolution-reason" className={pfxLabelClass}>
              Razón
            </label>
            <textarea
              id="resolution-reason"
              value={resolutionReason}
              onChange={(e) => setResolutionReason(e.target.value)}
              rows={2}
              placeholder="Explica la resolución (mínimo 5 caracteres)…"
              className={pfxTextareaClass}
            />
            {resolutionError && <p className="mt-2 text-xs text-pfx-error">{resolutionError}</p>}
            <button
              type="button"
              onClick={submitResolution}
              disabled={resolutionReason.trim().length < MIN_REASON_LENGTH || resolutionBusy}
              className="mt-3 flex items-center gap-1.5 rounded-[var(--pfx-radius)] bg-pfx-accent px-3 py-1.5 text-xs font-medium text-pfx-on-accent transition-colors hover:bg-pfx-accent-strong disabled:opacity-40"
            >
              {resolutionBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              Confirmar
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={rcOpen} onOpenChange={setRcOpen}>
        <DialogContent className="border-pfx-border bg-pfx-surface text-pfx-text" data-product="pixelforge">
          <DialogHeader>
            <DialogTitle>Solicitar cambios</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className={pfxLabelClass}>Tipo de cambio</label>
              <Select
                value={rcChangeKind}
                onValueChange={(v) => {
                  setRcChangeKind(v as ChangeKind);
                  setRcContentTarget(null);
                }}
              >
                <SelectTrigger aria-label="Tipo de cambio" className={pfxSelectTriggerClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={pfxSelectContentClass} data-product="pixelforge">
                  {CHANGE_KIND_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {rcChangeKind === "contenido" && (
              <div>
                <label className={pfxLabelClass}>Destino de contenido</label>
                <Select value={rcContentTarget ?? ""} onValueChange={(v) => setRcContentTarget(v as typeof rcContentTarget)}>
                  <SelectTrigger aria-label="Destino de contenido" className={pfxSelectTriggerClass}>
                    <SelectValue placeholder="Elige un destino…" />
                  </SelectTrigger>
                  <SelectContent className={pfxSelectContentClass} data-product="pixelforge">
                    {CONTENT_TARGET_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <label htmlFor="rc-reason" className={pfxLabelClass}>
                Razón del cambio
              </label>
              <textarea
                id="rc-reason"
                value={rcReason}
                onChange={(e) => setRcReason(e.target.value)}
                rows={2}
                placeholder="Explica qué cambiar (mínimo 5 caracteres)…"
                className={pfxTextareaClass}
              />
            </div>

            {rcTarget && (
              <div className="rounded-[var(--pfx-radius)] border border-pfx-border bg-pfx-surface-elevated px-3 py-2.5 text-xs text-pfx-text-muted">
                {rcTarget.mechanism === "technical_block" && <p>Bloqueo técnico: no se regenera nada.</p>}
                {rcTarget.mechanism === "regress_station" && (
                  <p>El proyecto retrocede a {getStationMeta(rcTarget.station!).stepLabel} para recomponer.</p>
                )}
                {rcTarget.mechanism === "reopen_artifact" && (
                  <>
                    <p>
                      Reabrirá {ARTIFACT_KIND_LABEL[rcTarget.artifactKind!]} en la estación{" "}
                      {getStationMeta(rcTarget.station!).stepLabel}.
                    </p>
                    {rcDownstream.length > 0 && (
                      <p className="mt-1">
                        Esto invalidará: {rcDownstream.map((k) => ARTIFACT_KIND_LABEL[k]).join(", ")}.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {decisionError && <p className="text-xs text-pfx-error">{decisionError}</p>}

            <button
              type="button"
              onClick={submitRequestChanges}
              disabled={!rcValid || rcBusy}
              className="flex items-center gap-1.5 rounded-[var(--pfx-radius)] bg-pfx-accent px-3 py-1.5 text-xs font-medium text-pfx-on-accent transition-colors hover:bg-pfx-accent-strong disabled:opacity-40"
            >
              {rcBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              Confirmar solicitud
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={apOpen} onOpenChange={setApOpen}>
        <DialogContent className="border-pfx-border bg-pfx-surface text-pfx-text sm:max-w-lg" data-product="pixelforge">
          <DialogHeader>
            <DialogTitle>Aprobar revisión</DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] space-y-3 overflow-y-auto">
            {apBlocking.length > 0 && (
              <p className="rounded-[var(--pfx-radius)] border border-pfx-error/30 bg-[hsl(var(--pfx-error)/0.08)] px-3 py-2.5 text-xs text-pfx-error">
                Hay hallazgos bloqueantes en el QA anclado — no se puede aprobar.
              </p>
            )}

            {needsChecklist && (
              <div>
                <p className="mb-2 text-xs font-medium text-pfx-text">
                  Riesgos del QA — todos los mayores deben aceptarse con justificación
                </p>
                <ul className="space-y-2">
                  {apChecklistItems.map((f) => {
                    const required = f.severity === "major";
                    return (
                      <li key={f.id} className="rounded-[var(--pfx-radius)] border border-pfx-border p-2">
                        <label className="flex items-start gap-2 text-xs">
                          <Checkbox
                            checked={apChecked.has(f.id)}
                            onCheckedChange={() => toggleApChecked(f.id)}
                            className={`mt-0.5 ${pfxCheckboxClass}`}
                            aria-label={`${f.checkCode}${required ? " (obligatorio)" : " (opcional)"}`}
                          />
                          <span>
                            <span className="font-forge-mono font-semibold text-pfx-text">{f.checkCode}</span>{" "}
                            <span className="text-pfx-text-muted">
                              {required ? "· mayor · obligatorio" : "· menor · opcional"}
                            </span>
                            <p className="text-pfx-text-muted">{f.title}</p>
                          </span>
                        </label>
                        {apChecked.has(f.id) && (
                          <div className="mt-1.5">
                            <label htmlFor={`ap-rationale-${f.id}`} className="sr-only">
                              {`Justificación ${f.checkCode}`}
                            </label>
                            <textarea
                              id={`ap-rationale-${f.id}`}
                              aria-label={`Justificación ${f.checkCode}`}
                              value={apRationale[f.id] ?? ""}
                              onChange={(e) => setApRationale((prev) => ({ ...prev, [f.id]: e.target.value }))}
                              rows={2}
                              placeholder="Justifica por qué aceptas este riesgo (mínimo 5 caracteres)…"
                              className={pfxTextareaClass}
                            />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <div>
              <label htmlFor="ap-reason" className={pfxLabelClass}>
                Razón global
              </label>
              <textarea
                id="ap-reason"
                value={apReason}
                onChange={(e) => setApReason(e.target.value)}
                rows={2}
                placeholder="Explica la aprobación (mínimo 5 caracteres)…"
                className={pfxTextareaClass}
              />
            </div>

            {activeOrLatestReview && (
              <p className="rounded-[var(--pfx-radius)] border border-pfx-border bg-pfx-surface-elevated px-3 py-2.5 text-xs text-pfx-text-muted">
                Aprobarás v{currentPageVersion.version} evaluada por QA (score {activeOrLatestReview.scoreSnapshot}). El
                proyecto quedará release-ready.
              </p>
            )}

            {decisionError && <p className="text-xs text-pfx-error">{decisionError}</p>}

            <button
              type="button"
              onClick={submitApprove}
              disabled={!apValid || apBusy}
              className="flex items-center gap-1.5 rounded-[var(--pfx-radius)] bg-pfx-accent px-3 py-1.5 text-xs font-medium text-pfx-on-accent transition-colors hover:bg-pfx-accent-strong disabled:opacity-40"
            >
              {apBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              Confirmar aprobación
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="border-pfx-border bg-pfx-surface text-pfx-text" data-product="pixelforge">
          <DialogHeader>
            <DialogTitle>Cancelar revisión</DialogTitle>
          </DialogHeader>
          <div>
            <label htmlFor="cancel-reason" className={pfxLabelClass}>
              Razón
            </label>
            <textarea
              id="cancel-reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={2}
              placeholder="Explica por qué cancelas (mínimo 5 caracteres)…"
              className={pfxTextareaClass}
            />
            {decisionError && <p className="mt-2 text-xs text-pfx-error">{decisionError}</p>}
            <button
              type="button"
              onClick={submitCancel}
              disabled={cancelReason.trim().length < MIN_REASON_LENGTH || cancelBusy}
              className="mt-3 flex items-center gap-1.5 rounded-[var(--pfx-radius)] border border-pfx-border px-3 py-1.5 text-xs font-medium text-pfx-text transition-colors hover:border-pfx-error/40 hover:text-pfx-error disabled:opacity-40"
            >
              {cancelBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              Confirmar cancelación
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface StageBannerProps {
  stage: ReviewStage;
  projectId: string;
  currentVersion: number;
  gateReason: string | null;
  review: ReviewView | null;
  releaseReady: boolean;
  onOpenReview: () => void;
  openBusy: boolean;
}

/**
 * Banner por `stage` (sección B). Extraído como función auxiliar del mismo
 * archivo (no un componente separado exportado — YAGNI, T5 es el único
 * consumidor) para mantener legible el render principal.
 */
function StageBanner({
  stage,
  projectId,
  currentVersion,
  gateReason,
  review,
  releaseReady,
  onOpenReview,
  openBusy,
}: StageBannerProps) {
  if (stage === "awaiting_qa") {
    return (
      <ForgeZone state="draft" className="p-4">
        <p className="text-sm font-medium text-pfx-text">La versión vigente espera su temple</p>
        <p className="mt-1 text-xs text-pfx-text-muted">
          {gateReason === "pending_decision" && "El QA pasó con advertencias pero falta tu decisión en QA."}
          {gateReason === "rejected" && "Rechazaste el último temple con reservas."}
          {gateReason === "stale" && "El temple más reciente es de una versión anterior — re-ejecuta QA."}
          {(!gateReason || gateReason === "no_qa") && "Todavía no hay un QA cerrado para la vigente."}
        </p>
        <Link
          href={`/proyectos/pixelforge/${projectId}/qa`}
          className="mt-3 inline-flex items-center gap-2 rounded-[var(--pfx-radius)] bg-pfx-accent px-4 py-2 text-sm font-medium text-pfx-on-accent transition-colors hover:bg-pfx-accent-strong"
        >
          Ir a QA
        </Link>
      </ForgeZone>
    );
  }

  if (stage === "qa_failed") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--pfx-radius)] border border-pfx-error/30 bg-[hsl(var(--pfx-error)/0.08)] px-3 py-2.5 text-xs text-pfx-error">
        <span>El último temple quedó quebradizo — no se puede abrir revisión.</span>
        <Link
          href={`/proyectos/pixelforge/${projectId}/produccion`}
          className="flex-shrink-0 rounded-[var(--pfx-radius)] border border-pfx-error/30 bg-[hsl(var(--pfx-error)/0.1)] px-3 py-1.5 font-medium text-pfx-error transition-colors hover:bg-[hsl(var(--pfx-error)/0.2)]"
        >
          Volver a Producción
        </Link>
      </div>
    );
  }

  if (stage === "ready_for_review") {
    return (
      <ForgeZone state="forging" variant="elevated" className="p-4">
        <p className="text-sm font-medium text-pfx-text">El temple está listo para revisión</p>
        <p className="mt-1 text-xs text-pfx-text-muted">Abre una ronda de revisión para decidir sobre v{currentVersion}.</p>
        <button
          type="button"
          onClick={onOpenReview}
          disabled={openBusy}
          className="mt-3 flex items-center gap-2 rounded-[var(--pfx-radius)] bg-pfx-accent px-4 py-2 text-sm font-medium text-pfx-on-accent transition-colors hover:bg-pfx-accent-strong disabled:opacity-40"
        >
          {openBusy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Abrir revisión
        </button>
      </ForgeZone>
    );
  }

  if (stage === "in_review" && review) {
    return (
      <ForgeZone state="forging" variant="elevated" className="p-4">
        <p className="text-sm font-medium text-pfx-text">
          Ronda {review.roundNumber} abierta por {review.openedByName} · {formatReviewDate(review.createdAt)}
        </p>
      </ForgeZone>
    );
  }

  if (stage === "changes_requested" && review) {
    const stationLabel = review.targetStation ? getStationMeta(review.targetStation).stepLabel : "bloqueo técnico";
    return (
      <div className="rounded-[var(--pfx-radius)] border border-pfx-warning/30 bg-[hsl(var(--pfx-warning)/0.08)] px-3 py-2.5 text-xs text-pfx-warning">
        <p className="font-medium">Se solicitaron cambios · {stationLabel}</p>
        {review.requestReason && <p className="mt-1">{`"${review.requestReason}"`}</p>}
      </div>
    );
  }

  if (stage === "approved" && review) {
    if (releaseReady) {
      return (
        <ForgeZone state="sealed" variant="elevated" className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <ForgeStamp sealedAt={review.approvedAt ?? review.closedAt ?? review.createdAt} />
            <ForgeStationBadge status="approved" currentStation="revision" />
          </div>
          <p className="mt-2 text-sm font-medium text-pfx-text">
            RELEASE-READY · v{currentVersion} aprobada por {review.approvedByName ?? "alguien"}
          </p>
          {review.approvalReason && (
            <p className="mt-1 text-xs text-pfx-text-muted">{`"${review.approvalReason}"`}</p>
          )}
        </ForgeZone>
      );
    }
    // Defensivo — por construcción de `computeReviewStage`/`isReleaseReady`
    // (mismo `review`, mismas condiciones) esta rama es inalcanzable HOY,
    // pero se mantiene por si el dominio cambia: una aprobación "histórica"
    // (de una versión que ya no es la vigente) se trata igual que
    // `superseded` — mismo texto, mismo criterio informativo.
    return (
      <div className="flex items-start gap-2 rounded-[var(--pfx-radius)] border border-pfx-border bg-pfx-surface px-3 py-2.5 text-xs text-pfx-text-muted">
        <RotateCcw className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
        La aprobación quedó superseded por v{currentVersion}.
      </div>
    );
  }

  // draft nunca llega acá (gate de entrada corta antes) — queda por completitud del tipo.
  return (
    <ForgeZone variant="elevated" state="locked" className="px-6 py-12 text-center">
      <p className="text-sm font-medium text-pfx-text">Aún no hay versión compuesta</p>
    </ForgeZone>
  );
}
