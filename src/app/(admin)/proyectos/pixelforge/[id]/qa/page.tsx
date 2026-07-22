import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import {
  getPixelforgeProjectFull,
  listPageVersions,
  listQaRunsForProject,
  getActiveQaRun,
  getQaRunWithFindings,
} from "@/lib/db/repos/pixelforge";
import { computeQaGateState } from "@/lib/pixelforge/qa/gate-state";
import { QaStationPanel, type QaFindingView, type QaRunView } from "@/components/pixelforge/QaStationPanel";

export const metadata: Metadata = {
  title: "QA — PixelForge — PixelTEC OS",
};

export default async function PixelforgeQaPage({
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

  const [versionRows, runRows, activeRun] = await Promise.all([
    listPageVersions(id, ownerId),
    listQaRunsForProject(id, ownerId),
    getActiveQaRun(id, ownerId),
  ]);

  // Vigente = mayor `version` (orden desc de `listPageVersions`, `[0]`) — mismo criterio que `ProductionPanel`/`produccion/page.tsx`.
  const currentVersion = versionRows[0] ?? null;
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
    // jsonb (`unknown` en Drizzle) — mismo criterio de cast que el resto del árbol de pixelforge (p.ej. `compose_page_tree` con `designTokens`).
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

  // Gate puro (`gate-state.ts`, T7) — la MISMA regla que ya aplica el backend
  // (finalizeQaRunOrchestrated/decision/route.ts), reexpresada acá solo para
  // saber DE QUÉ run traer los findings del header; el panel (client) vuelve
  // a llamar esta misma función pura sobre las mismas `runs` para renderizar
  // — nunca se recomputa nada semánticamente distinto en dos lugares.
  const gate = computeQaGateState<QaRunView>(runs, currentVersion?.id ?? null);

  let currentRunFindings: QaFindingView[] = [];
  if (gate.currentVersionRun) {
    const withFindings = await getQaRunWithFindings(gate.currentVersionRun.id, ownerId);
    currentRunFindings = (withFindings?.findings ?? []).map((f) => ({
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

  // `assetId → url` de las capturas del qa-runner — join en memoria desde
  // `full.assets` (ya trae TODOS los assets del proyecto, F4), mismo patrón
  // que `visual/page.tsx` usa para `visualReferences.assetId` (sin tocar el
  // backend: `getPixelforgeProjectFull` ya devuelve esto).
  const screenshotUrlByAssetId: Record<string, string> = Object.fromEntries(
    full.assets.filter((a) => a.kind === "qa_screenshot").map((a) => [a.id, a.url])
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <QaStationPanel
        projectId={id}
        currentPageVersion={currentVersion ? { id: currentVersion.id, version: currentVersion.version } : null}
        initialActiveRunId={activeRun?.id ?? null}
        runs={runs}
        currentRunFindings={currentRunFindings}
        screenshotUrlByAssetId={screenshotUrlByAssetId}
      />
    </div>
  );
}
