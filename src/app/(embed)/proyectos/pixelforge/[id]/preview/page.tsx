/**
 * Preview embebible de la landing — se renderiza DENTRO de un <iframe>
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
 * Render (F7-T4, D5): si el proyecto tiene una `page_version` vigente
 * (`getLatestPageVersion`) se renderiza ESE árbol — pasa por `validatePageTree`
 * igual, pero aquí un `ok:false` significa corrupción real (la puerta ya corrió
 * una vez en el insert de `compose_page_tree`), así que se lanza con un mensaje
 * distinto al del fixture. Sin ninguna versión compuesta (pre-composición) se
 * conserva el fixture como demo del sistema de diseño, con la misma validación
 * de dogfooding (si el fixture no valida, se lanza — el fixture NO debe romper
 * el pipeline). Los tokens salen de la dirección creativa elegida del proyecto
 * si existe; si no, `DEFAULT_PREVIEW_TOKENS`. El ancho de dispositivo lo
 * controla el iframe padre — NO hay `?device=` aquí.
 */
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { getPixelforgeProjectFull, getLatestPageVersion } from "@/lib/db/repos/pixelforge";
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

  // D5: si el proyecto ya compuso una landing, esa es la vigente — se renderiza
  // ESE árbol, no el fixture.
  const latestVersion = await getLatestPageVersion(id, ownerId);
  if (latestVersion) {
    const v = validatePageTree(latestVersion.tree);
    if (!v.ok) {
      // La puerta ya corrió una vez en el insert (compose_page_tree) — que
      // falle aquí es corrupción real de la fila, no un árbol mal compuesto.
      throw new Error(
        `La versión compuesta del proyecto está corrupta: ${v.errors.join(" | ")}`
      );
    }
    return <PageRenderer tree={v.tree} tokens={tokens} motionDna={motionDna} />;
  }

  // Sin ninguna versión compuesta: fixture como demo del sistema de diseño.
  // Dogfooding: el fixture pasa por la MISMA puerta que cualquier árbol real.
  const v = validatePageTree(PREVIEW_FIXTURE_TREE);
  if (!v.ok) {
    throw new Error(`El fixture de preview no valida: ${v.errors.join(" | ")}`);
  }

  return <PageRenderer tree={v.tree} tokens={tokens} motionDna={motionDna} />;
}
