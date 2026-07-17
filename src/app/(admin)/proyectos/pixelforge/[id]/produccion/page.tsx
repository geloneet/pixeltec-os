import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { getPixelforgeProjectFull } from "@/lib/db/repos/pixelforge";
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

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="mb-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3">
        <p className="text-sm font-medium text-foreground">
          Preview del sistema de diseño (F6A)
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Esta vista renderiza un contenido de muestra con la dirección creativa del proyecto
          para revisar los bloques y los tokens. El workspace de producción (edición de la landing
          real) llega en F7.
        </p>
      </div>

      <PreviewFrame projectId={full.project.id} />
    </div>
  );
}
