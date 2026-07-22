import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { getPixelforgeProjectFull, listPageVersions, listReviewsForProject } from "@/lib/db/repos/pixelforge";
import {
  ProductionPanel,
  type ProductionChangesRequestedReviewView,
  type ProductionVersionView,
} from "@/components/pixelforge/ProductionPanel";
import { PreviewFrame } from "@/components/pixelforge/render/PreviewFrame";

export const metadata: Metadata = {
  title: "Producción — PixelForge — PixelTEC OS",
};

export default async function PixelforgeProduccionPage({
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

  const blueprintArtifact = full.artifacts.find((a) => a.kind === "narrative_blueprint");
  const blueprintSealed = blueprintArtifact?.status === "sealed";
  const blueprintSealedAt = blueprintArtifact?.sealedAt ? blueprintArtifact.sealedAt.toISOString() : null;

  // `listPageVersions` alcanza para vigente + historial (orden desc, `[0]` es
  // la vigente) — sin `tree` (jsonb potencialmente grande, sin uso acá: la
  // preview real la sirve la ruta `/preview`, T4, no esta page). No hace
  // falta además `getLatestPageVersion` (que sí trae el `tree` completo): el
  // panel solo necesita metadatos, y traer el árbol completo por nada sería
  // trabajo/tráfico de más.
  //
  // Visibilidad cross-estación (F9 T6, SOLO lectura): `listReviewsForProject`
  // ya llega desc por `roundNumber` (mismo criterio que `activeOrLatestReview`
  // en `revision/page.tsx`), así que `[0]` es la MÁS RECIENTE.
  const [versionRows, reviewRows] = await Promise.all([
    listPageVersions(id, ownerId),
    listReviewsForProject(id, ownerId),
  ]);
  const versions: ProductionVersionView[] = versionRows.map((v) => ({
    id: v.id,
    version: v.version,
    notas: v.notas,
    warnings: v.warnings,
    createdByName: v.createdByName,
    createdAt: v.createdAt.toISOString(),
  }));

  // Solo se muestra si la más reciente quedó `changes_requested` — al
  // recomponer, la nueva `page_version` la deja `superseded` (T3), así que
  // esto vuelve a `null` sin ningún cambio adicional acá.
  const latestReview = reviewRows[0] ?? null;
  const latestChangesRequestedReview: ProductionChangesRequestedReviewView | null =
    latestReview && latestReview.status === "changes_requested"
      ? {
          roundNumber: latestReview.roundNumber,
          requestReason: latestReview.requestReason,
          targetStation: latestReview.targetStation,
        }
      : null;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 space-y-6">
      <div>
        <ProductionPanel
          projectId={id}
          blueprintSealed={blueprintSealed}
          blueprintSealedAt={blueprintSealedAt}
          versions={versions}
          latestChangesRequestedReview={latestChangesRequestedReview}
        />
      </div>

      <div>
        <PreviewFrame projectId={full.project.id} />
      </div>
    </div>
  );
}
