/**
 * Preview embebible de la landing (F6A) — se renderiza DENTRO de un <iframe>
 * same-origin desde las páginas admin (`produccion`, via `PreviewFrame`). Vive
 * en el route group `(embed)` para NO heredar el chrome admin: misma URL
 * (`/proyectos/pixelforge/<id>/preview`), sin sidebar/stepper/header.
 *
 * Auth propia (NO hereda los gates de `(admin)/[id]/layout.tsx`, que está en
 * otro route group): `auth()` + `getPixelforgeProjectFull(id, ownerId)` →
 * `notFound()` si no existe o no es del owner (IDOR = Critical). El middleware
 * ya protege `/proyectos/*` por prefijo; este gate añade la propiedad por
 * proyecto.
 *
 * Render (F6A): SIEMPRE el fixture (`page_versions` reales llegan en F7). El
 * fixture pasa por `validatePageTree` en runtime — si no valida, se lanza
 * (dogfooding: el fixture NO debe romper el pipeline). Los tokens salen de la
 * dirección creativa elegida del proyecto si existe; si no, `DEFAULT_PREVIEW_TOKENS`.
 * El ancho de dispositivo lo controla el iframe padre — NO hay `?device=` aquí.
 */
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { getPixelforgeProjectFull } from "@/lib/db/repos/pixelforge";
import { validatePageTree } from "@/lib/pixelforge/registry/validate-page-tree";
import { PageRenderer } from "@/components/pixelforge/render/PageRenderer";
import type { DesignTokens } from "@/components/pixelforge/render/tokens";
import type { MotionDnaInput } from "@/components/pixelforge/render/motion/resolve";
import { PREVIEW_FIXTURE_TREE, DEFAULT_PREVIEW_TOKENS } from "@/lib/pixelforge/fixtures/preview-tree";

export const metadata: Metadata = {
  title: "Vista previa — PixelForge",
  // El preview no debe indexarse ni aparecer suelto en resultados.
  robots: { index: false, follow: false },
};

export default async function PixelforgePreviewPage({
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

  // Tokens de la dirección elegida (si la hay), si no los neutros por defecto.
  const chosen = full.project.chosenDirectionId
    ? full.directions.find((d) => d.id === full.project.chosenDirectionId)
    : undefined;
  const tokens: DesignTokens = chosen
    ? (chosen.designTokens as DesignTokens)
    : DEFAULT_PREVIEW_TOKENS;
  // Motion DNA de la dirección elegida (mismo cast que designTokens): modula
  // el motion en el resolver. Sin dirección elegida, MotionSection usa defaults.
  const motionDna = chosen?.motionDna as MotionDnaInput | undefined;

  // Dogfooding: el fixture pasa por la MISMA puerta que cualquier árbol real.
  const v = validatePageTree(PREVIEW_FIXTURE_TREE);
  if (!v.ok) {
    throw new Error(`El fixture de preview no valida: ${v.errors.join(" | ")}`);
  }

  return <PageRenderer tree={v.tree} tokens={tokens} motionDna={motionDna} />;
}
