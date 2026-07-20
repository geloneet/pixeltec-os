import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { getPixelforgeProjectFull } from "@/lib/db/repos/pixelforge";
import { DirectionsPanel } from "@/components/pixelforge/DirectionsPanel";
import { SealBar } from "@/components/pixelforge/SealBar";
import { SIGNATURE_CAPABILITIES } from "@/lib/pixelforge/registry/capabilities";
import type { DirectionCardView, PackedScoresView } from "@/components/pixelforge/DirectionCard";
import type { Direccion } from "@/lib/pixelforge/schemas/generate-directions";
import type { DirectionDecision } from "@/lib/pixelforge/schemas/direction-decision";

export const metadata: Metadata = {
  title: "Direcciones — PixelForge — PixelTEC OS",
};

export default async function PixelforgeDireccionesPage({
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

  const { artifacts, directions } = full;

  // Defensivo: `createPixelforgeProject` siempre crea las 5 filas de artifact
  // (una por `ARTIFACT_KINDS`) al crear el proyecto — no debería faltar.
  const artifact = artifacts.find((a) => a.kind === "direction_decision");
  if (!artifact) notFound();

  const visualDnaArtifact = artifacts.find((a) => a.kind === "visual_dna");
  const visualSealed = visualDnaArtifact?.status === "sealed";

  // jsonb infiere `unknown` en Drizzle — se castea al tipo del schema, mismo
  // criterio que `visual/page.tsx` con `VisualDna`.
  const draft = (
    artifact.status === "sealed" ? artifact.sealedContent : artifact.currentDraft
  ) as DirectionDecision | null;

  const directionViews: DirectionCardView[] = directions.map((d) => ({
    id: d.id,
    slot: d.slot,
    title: d.title,
    concept: d.concept,
    designTokens: d.designTokens as Direccion["designTokens"],
    motionDna: d.motionDna as Direccion["motionDna"],
    signatureMotif: d.signatureMotif as Direccion["signatureMotif"],
    signatureComponent: d.signatureComponent as Direccion["signatureComponent"],
    scores: d.scores as PackedScoresView,
    scoreTotal: d.scoreTotal,
    status: d.status,
  }));

  const capabilityNames = Object.fromEntries(
    SIGNATURE_CAPABILITIES.map((capability) => [capability.id, capability.name])
  );

  // Elección obsoleta (decisión F5 #6, mismo criterio que `DirectionsPanel`):
  // el draft apunta a una dirección que ya no está vigente como "chosen" —
  // bloquea el sellado hasta que se vuelva a elegir.
  const obsolete =
    !!draft && !directionViews.some((d) => d.id === draft.chosenDirectionId && d.status === "chosen");

  const sealedAtIso = artifact.sealedAt ? artifact.sealedAt.toISOString() : null;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 space-y-6">
      <div>
        <DirectionsPanel
          projectId={id}
          artifactStatus={artifact.status}
          visualSealed={visualSealed}
          directions={directionViews}
          capabilityNames={capabilityNames}
          draft={draft}
          sealedAt={sealedAtIso}
        />
      </div>

      <div>
        <SealBar
          projectId={id}
          artifactStatus={artifact.status}
          kind="direction_decision"
          kindLabel="Decisión de dirección"
          sealedByName={artifact.sealedByName}
          sealedAt={sealedAtIso}
          canSeal={!!draft && !obsolete}
          // Reabrir la decisión SÍ invalida el Blueprint narrativo downstream.
          downstreamWarning={artifact.status === "sealed"}
        />
      </div>
    </div>
  );
}
