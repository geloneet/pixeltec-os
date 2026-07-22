import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import {
  getPixelforgeProjectFull,
  listPageVersions,
  listQaRunsForProject,
  listReviewsForProject,
  listCommentsForProject,
  getLatestPageVersion,
  getQaRunWithFindings,
} from "@/lib/db/repos/pixelforge";
import { computeQaGateState } from "@/lib/pixelforge/qa/gate-state";
import {
  ReviewStationPanel,
  type ReviewCommentView,
  type ReviewEventView,
  type ReviewTreeNodeView,
  type ReviewView,
} from "@/components/pixelforge/ReviewStationPanel";
import type { QaFindingView, QaRunView } from "@/components/pixelforge/QaStationPanel";

export const metadata: Metadata = {
  title: "Revisión — PixelForge — PixelTEC OS",
};

export default async function PixelforgeRevisionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const ownerId = session?.user?.id;
  if (!ownerId) redirect("/login?redirect=/proyectos/pixelforge");

  const { id } = await params;
  // Escopado por owner (IDOR = Critical) — mismo patrón que las demás estaciones.
  const full = await getPixelforgeProjectFull(id, ownerId);
  if (!full) notFound();

  const [versionRows, runRows, reviewRows, commentRows, latestVersionFull] = await Promise.all([
    listPageVersions(id, ownerId),
    listQaRunsForProject(id, ownerId),
    listReviewsForProject(id, ownerId),
    listCommentsForProject(id, ownerId),
    getLatestPageVersion(id, ownerId),
  ]);

  // Vigente = mayor `version` — mismo criterio que `qa/page.tsx`/`ProductionPanel`.
  const currentVersionRow = versionRows[0] ?? null;
  const versionNumberById = new Map(versionRows.map((v) => [v.id, v.version]));

  const runs: QaRunView[] = runRows.map((r) => ({
    id: r.id,
    pageVersionId: r.pageVersionId,
    pageVersionNumber: versionNumberById.get(r.pageVersionId) ?? 0,
    status: r.status,
    progress: r.progress,
    currentPhase: r.currentPhase,
    verdict: r.verdict,
    scoreTotal: r.scoreTotal,
    categoryScores: r.categoryScores as QaRunView["categoryScores"],
    catalogVersion: r.catalogVersion,
    scoringVersion: r.scoringVersion,
    humanDecision: r.humanDecision as QaRunView["humanDecision"],
    humanDecisionByName: r.humanDecisionByName,
    humanDecisionAt: r.humanDecisionAt ? r.humanDecisionAt.toISOString() : null,
    humanDecisionReason: r.humanDecisionReason,
    error: r.error,
    createdAt: r.createdAt.toISOString(),
    finishedAt: r.finishedAt ? r.finishedAt.toISOString() : null,
  }));

  // Gate puro (`gate-state.ts`, T7/F8) — la MISMA regla que ya aplica el
  // backend, reexpresada acá solo para resolver de qué run traer los
  // findings del header cuando todavía no hay ninguna review (ver abajo). El
  // panel (client) vuelve a llamar `computeQaGateState`/`computeReviewStage`
  // sobre los mismos datos — nunca se recomputa nada semánticamente distinto
  // en dos lugares (mismo criterio que `qa/page.tsx`).
  const gate = computeQaGateState<QaRunView>(runs, currentVersionRow?.id ?? null);

  // La `in_review` si hay, si no la de `roundNumber` máximo (`reviewRows` ya
  // llega desc por `roundNumber` — `listReviewsForProject`).
  const activeOrLatestReview = reviewRows.find((r) => r.status === "in_review") ?? reviewRows[0] ?? null;

  // Findings del run ANCLADO: el de la review visible (`review.qaRunId`) si
  // existe una — es el mismo run que el backend valida en `approveReview`
  // (T3, paso 8, "ESCOPADOS al run anclado") — si no hay ninguna review
  // todavía, cae al run cerrado de la vigente (mismo dato que `QaStationPanel`
  // llama "Temple").
  const anchoredRunId = activeOrLatestReview?.qaRunId ?? gate.currentVersionRun?.id ?? null;
  let anchoredRunFindings: QaFindingView[] = [];
  if (anchoredRunId) {
    const withFindings = await getQaRunWithFindings(anchoredRunId, ownerId);
    anchoredRunFindings = (withFindings?.findings ?? []).map((f) => ({
      id: f.id,
      checkCode: f.checkCode,
      category: f.category,
      severity: f.severity,
      blocking: f.blocking,
      source: f.source,
      title: f.title,
      description: f.description,
      recommendation: f.recommendation,
      evidence: f.evidence,
      location: f.location as QaFindingView["location"],
      locationKey: f.locationKey,
    }));
  }

  // needsReanchor: la ronda `in_review` quedó anclada a un `qa_run` que ya no
  // es el más reciente CERRADO de su misma versión — mismo chequeo que
  // `approveReview` (T3, paso 5) hace server-side antes de aprobar.
  const needsReanchor =
    !!activeOrLatestReview &&
    activeOrLatestReview.status === "in_review" &&
    !!gate.currentVersionRun &&
    gate.currentVersionRun.id !== activeOrLatestReview.qaRunId;

  // Nodos del árbol de la vigente — SOLO para el ancla "sección" del alta de
  // comentario (`revision/page.tsx` es el único caller que necesita el árbol
  // completo; `listPageVersions` deliberadamente no lo trae, ver su docstring).
  const tree = latestVersionFull?.tree as { nodes?: { nodeId: string; componentId: string; orden: number }[] } | null;
  const treeNodes: ReviewTreeNodeView[] = (tree?.nodes ?? []).map((n) => ({
    nodeId: n.nodeId,
    componentId: n.componentId,
    orden: n.orden,
  }));

  const reviews: ReviewView[] = reviewRows.map((r) => ({
    id: r.id,
    pageVersionId: r.pageVersionId,
    qaRunId: r.qaRunId,
    roundNumber: r.roundNumber,
    status: r.status,
    verdictSnapshot: r.verdictSnapshot,
    scoreSnapshot: r.scoreSnapshot,
    targetStation: r.targetStation,
    requestReason: r.requestReason,
    acceptedRisks: r.acceptedRisks as ReviewView["acceptedRisks"],
    approvedByName: r.approvedByName,
    approvedAt: r.approvedAt ? r.approvedAt.toISOString() : null,
    approvalReason: r.approvalReason,
    openedByName: r.openedByName,
    createdAt: r.createdAt.toISOString(),
    closedAt: r.closedAt ? r.closedAt.toISOString() : null,
  }));

  const comments: ReviewCommentView[] = commentRows.map((c) => ({
    id: c.id,
    reviewId: c.reviewId,
    anchorType: c.anchorType,
    nodeId: c.nodeId,
    findingId: c.findingId,
    body: c.body,
    blocking: c.blocking,
    status: c.status,
    authorName: c.authorName,
    createdAt: c.createdAt.toISOString(),
    resolvedByName: c.resolvedByName,
    resolvedAt: c.resolvedAt ? c.resolvedAt.toISOString() : null,
    resolutionReason: c.resolutionReason,
  }));

  // Timeline: eventos `station IN ('qa','revision')` — `full.events` YA viene
  // desc por `createdAt` (`getPixelforgeProjectFull`), se filtra en memoria
  // (mismo patrón in-memory-join que `qa/page.tsx` usa para
  // `screenshotUrlByAssetId` con `full.assets`) en vez de agregar un nuevo
  // lector al repo.
  const events: ReviewEventView[] = full.events
    .filter((e) => e.station === "qa" || e.station === "revision")
    .slice(0, 50)
    .map((e) => ({
      id: e.id,
      type: e.type,
      actorName: e.actorName,
      reason: e.reason,
      createdAt: e.createdAt.toISOString(),
    }));

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <ReviewStationPanel
        projectId={id}
        currentPageVersion={
          currentVersionRow
            ? {
                id: currentVersionRow.id,
                version: currentVersionRow.version,
                createdByName: currentVersionRow.createdByName,
                createdAt: currentVersionRow.createdAt.toISOString(),
              }
            : null
        }
        runs={runs}
        reviews={reviews}
        comments={comments}
        anchoredRunFindings={anchoredRunFindings}
        treeNodes={treeNodes}
        events={events}
        needsReanchor={needsReanchor}
      />
    </div>
  );
}
