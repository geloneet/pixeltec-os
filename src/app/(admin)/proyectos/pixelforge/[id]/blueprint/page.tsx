import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { getPixelforgeProjectFull } from "@/lib/db/repos/pixelforge";
import { BlueprintPanel } from "@/components/pixelforge/BlueprintPanel";
import { SealBar } from "@/components/pixelforge/SealBar";
import type { DirectionDecision } from "@/lib/pixelforge/schemas/direction-decision";
import type { NarrativeBlueprint } from "@/lib/pixelforge/schemas/build-narrative";

export const metadata: Metadata = {
  title: "Blueprint — PixelForge — PixelTEC OS",
};

export default async function PixelforgeBlueprintPage({
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
  const artifact = artifacts.find((a) => a.kind === "narrative_blueprint");
  if (!artifact) notFound();

  const decisionArtifact = artifacts.find((a) => a.kind === "direction_decision");
  const decisionSealed = decisionArtifact?.status === "sealed";

  // jsonb infiere `unknown` en Drizzle — se castea al tipo del schema, mismo
  // criterio que `visual/page.tsx` con `VisualDna`.
  const draft = (
    artifact.status === "sealed" ? artifact.sealedContent : artifact.currentDraft
  ) as NarrativeBlueprint | null;

  // Elección obsoleta (mismo cálculo que `direcciones/page.tsx` L63-67):
  // la decisión sellada apunta a una dirección que ya no está vigente como
  // "chosen" — el guard de `build_narrative` (runs/route.ts) ya rechaza con
  // 409 en este estado, acá solo se refleja como aviso (defensa en
  // profundidad / TOCTOU, mismo criterio que el guard del backend).
  const sealedDecision = (
    decisionArtifact?.status === "sealed" ? decisionArtifact.sealedContent : null
  ) as DirectionDecision | null;
  const directionObsolete =
    !!sealedDecision &&
    !directions.some((d) => d.id === sealedDecision.chosenDirectionId && d.status === "chosen");

  const sealedAtIso = artifact.sealedAt ? artifact.sealedAt.toISOString() : null;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 space-y-6">
      <div>
        <BlueprintPanel
          projectId={id}
          artifactStatus={artifact.status}
          blueprint={draft}
          decisionSealed={decisionSealed}
          directionObsolete={directionObsolete}
          lastRunId={artifact.lastRunId}
          sealedAt={sealedAtIso}
        />
      </div>

      <div>
        <SealBar
          projectId={id}
          artifactStatus={artifact.status}
          kind="narrative_blueprint"
          kindLabel="Blueprint narrativo"
          sealedByName={artifact.sealedByName}
          sealedAt={sealedAtIso}
          canSeal={!!draft}
          // Downstream vacío hasta F7 (producción todavía no sella nada).
          downstreamWarning={false}
        />
      </div>
    </div>
  );
}
