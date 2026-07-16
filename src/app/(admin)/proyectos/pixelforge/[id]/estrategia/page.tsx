import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { getPixelforgeProjectFull } from "@/lib/db/repos/pixelforge";
import { LandingDnaPanel } from "@/components/pixelforge/LandingDnaPanel";
import { SealBar } from "@/components/pixelforge/SealBar";
import type { LandingDna } from "@/lib/pixelforge/schemas/generate-strategy";

export const metadata: Metadata = {
  title: "Estrategia — PixelForge — PixelTEC OS",
};

export default async function PixelforgeEstrategiaPage({
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

  const { artifacts } = full;

  // Defensivo: `createPixelforgeProject` siempre crea las 5 filas de artifact
  // (una por `ARTIFACT_KINDS`) al crear el proyecto — no debería faltar.
  const artifact = artifacts.find((a) => a.kind === "landing_dna");
  if (!artifact) notFound();

  const contextBrief = artifacts.find((a) => a.kind === "context_brief");
  const contextSealed = contextBrief?.status === "sealed";

  const dna = (
    artifact.status === "sealed" ? artifact.sealedContent : artifact.currentDraft
  ) as LandingDna | null;

  const sealedAtIso = artifact.sealedAt ? artifact.sealedAt.toISOString() : null;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="mb-6">
        <LandingDnaPanel
          projectId={id}
          artifactStatus={artifact.status}
          dna={dna}
          contextSealed={contextSealed}
          lastRunId={artifact.lastRunId}
        />
      </div>

      <div className="mb-6">
        <SealBar
          projectId={id}
          artifactStatus={artifact.status}
          kind="landing_dna"
          kindLabel="Landing DNA"
          sealedByName={artifact.sealedByName}
          sealedAt={sealedAtIso}
          canSeal={artifact.currentDraft != null}
          // Reabrir el Landing DNA SÍ invalida los sellos downstream
          // (visual/direcciones/blueprint) — ver reopenArtifact.
          downstreamWarning={artifact.status === "sealed"}
        />
      </div>
    </div>
  );
}
