import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { getPixelforgeProjectFull, listPageVersions } from "@/lib/db/repos/pixelforge";
import { ProductionPanel, type ProductionVersionView } from "@/components/pixelforge/ProductionPanel";
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
  const versionRows = await listPageVersions(id, ownerId);
  const versions: ProductionVersionView[] = versionRows.map((v) => ({
    id: v.id,
    version: v.version,
    notas: v.notas,
    warnings: v.warnings,
    createdByName: v.createdByName,
    createdAt: v.createdAt.toISOString(),
  }));

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 space-y-6">
      <div>
        <ProductionPanel
          projectId={id}
          blueprintSealed={blueprintSealed}
          blueprintSealedAt={blueprintSealedAt}
          versions={versions}
        />
      </div>

      <div>
        <PreviewFrame projectId={full.project.id} />
      </div>
    </div>
  );
}
