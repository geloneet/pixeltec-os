import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { getPixelforgeProjectFull } from "@/lib/db/repos/pixelforge";
import { ReferenceGrid, type VisualReferenceView } from "@/components/pixelforge/ReferenceGrid";
import { VisualDnaPanel } from "@/components/pixelforge/VisualDnaPanel";
import { SealBar } from "@/components/pixelforge/SealBar";
import type { ReferenceAnalysis } from "@/lib/pixelforge/schemas/analyze-reference";
import type { VisualDna } from "@/lib/pixelforge/schemas/synthesize-visual-dna";

export const metadata: Metadata = {
  title: "Visual — PixelForge — PixelTEC OS",
};

export default async function PixelforgeVisualPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const ownerId = session?.user?.id;
  if (!ownerId) redirect("/login?redirect=/proyectos/pixelforge");

  const { id } = await params;
  const full = await getPixelforgeProjectFull(id, ownerId);
  if (!full) notFound();

  const { artifacts, visualReferences, assets } = full;

  // Defensivo: `createPixelforgeProject` siempre crea las 5 filas de artifact
  // (una por `ARTIFACT_KINDS`) al crear el proyecto — no debería faltar.
  const artifact = artifacts.find((a) => a.kind === "visual_dna");
  if (!artifact) notFound();

  const landingDnaArtifact = artifacts.find((a) => a.kind === "landing_dna");
  const strategySealed = landingDnaArtifact?.status === "sealed";

  const dna = (
    artifact.status === "sealed" ? artifact.sealedContent : artifact.currentDraft
  ) as VisualDna | null;

  const sealedAtIso = artifact.sealedAt ? artifact.sealedAt.toISOString() : null;

  // `getPixelforgeProjectFull` no trae el join a `pixelforge_assets` resuelto
  // por referencia (solo el `assetId` crudo) — se resuelve acá contra la
  // lista de assets del proyecto en vez de tocar el repo por cada card.
  const assetUrlById = new Map(assets.map((a) => [a.id, a.url]));

  const mapped: VisualReferenceView[] = visualReferences.map((r) => ({
    id: r.id,
    kind: r.kind,
    label: r.label,
    url: r.url,
    assetUrl: r.assetId ? (assetUrlById.get(r.assetId) ?? null) : null,
    coverage: r.coverage,
    analysis: r.analysis as ReferenceAnalysis | null,
    weight: r.weight,
    note: r.note,
  }));

  const analyzedReferenceCount = visualReferences.filter((r) => r.analysis != null).length;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 space-y-6">
      <div>
        <ReferenceGrid projectId={id} references={mapped} />
      </div>

      <div>
        <VisualDnaPanel
          projectId={id}
          artifactStatus={artifact.status}
          dna={dna}
          strategySealed={strategySealed}
          analyzedReferenceCount={analyzedReferenceCount}
          references={mapped.map((r) => ({ id: r.id, label: r.label }))}
          lastRunId={artifact.lastRunId}
        />
      </div>

      <div>
        <SealBar
          projectId={id}
          artifactStatus={artifact.status}
          kind="visual_dna"
          kindLabel="Visual DNA"
          sealedByName={artifact.sealedByName}
          sealedAt={sealedAtIso}
          canSeal={artifact.currentDraft != null}
          // Reabrir el Visual DNA SÍ invalida los sellos downstream
          // (direcciones/blueprint) — ver reopenArtifact.
          downstreamWarning={artifact.status === "sealed"}
        />
      </div>
    </div>
  );
}
