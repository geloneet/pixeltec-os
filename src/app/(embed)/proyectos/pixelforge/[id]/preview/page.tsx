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
 *
 * Rama `?pfqa=` (PF-F8 T3): el qa-runner (T6, contenedor Playwright en red
 * interna) necesita cargar esta MISMA ruta SIN sesión de usuario y sobre una
 * versión EXACTA (no "la vigente" — el proyecto puede seguir componiendo
 * versiones nuevas mientras el QA corre sobre la que se le encoló). En vez de
 * `auth()`, esta rama confía en un token HMAC efímero (`preview-token.ts`)
 * cuyo `ownerId` es la identidad heredada de quien encoló el QA — CERO
 * superficie IDOR nueva porque todas las queries de la rama usan ese mismo
 * `ownerId`, nunca una sesión. La rama corre ANTES del flujo de sesión y con
 * `pfqa` ausente el resto de la función es idéntico al de siempre. Cualquier
 * fallo de validación (secreto ausente, token inválido/expirado, proyecto que
 * no coincide, qa_run que no está `running` o cuya versión no coincide)
 * resuelve en `notFound()` — la rama nunca debe hacer crash sobre entradas
 * arbitrarias, es la superficie sin sesión de la app.
 */
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import {
  getPixelforgeProjectFull,
  getLatestPageVersion,
  getQaRunWithFindings,
  getPageVersionById,
} from "@/lib/db/repos/pixelforge";
import { validatePageTree } from "@/lib/pixelforge/registry/validate-page-tree";
import { verifyQaPreviewToken } from "@/lib/pixelforge/qa/preview-token";
import { PageRenderer } from "@/components/pixelforge/render/PageRenderer";
import type { DesignTokens } from "@/components/pixelforge/render/tokens";
import type { MotionDnaInput } from "@/components/pixelforge/render/motion/resolve";
import { PREVIEW_FIXTURE_TREE, DEFAULT_PREVIEW_TOKENS } from "@/lib/pixelforge/fixtures/preview-tree";

export const metadata: Metadata = {
  title: "Vista previa — PixelForge",
  // El preview no debe indexarse ni aparecer suelto en resultados.
  robots: { index: false, follow: false },
};

/**
 * Resuelve la rama `?pfqa` completa: verifica el token, el qa_run ancla y
 * renderiza EXACTAMENTE la versión del token con la identidad del token. Toda
 * query de esta función usa `payload.ownerId` — jamás una sesión — ese es el
 * invariante de IDOR que protege esta rama.
 */
async function renderQaPreview(routeProjectId: string, pfqaToken: string) {
  const secret = process.env.QA_PREVIEW_TOKEN_SECRET;
  if (!secret) {
    // Sin secreto configurado, la rama entera queda deshabilitada — nunca un
    // crash por `undefined` pasado a HMAC.
    notFound();
    return null;
  }

  const payload = verifyQaPreviewToken(pfqaToken, secret, Math.floor(Date.now() / 1000));
  if (!payload) {
    notFound();
    return null;
  }

  if (payload.projectId !== routeProjectId) {
    notFound();
    return null;
  }

  // El qa_run es el ancla: debe existir, seguir `running` y apuntar a la
  // MISMA versión que el token (defensa doble — el token ya la trae, pero el
  // qa_run vivo en DB es la fuente de verdad de "todavía en curso").
  const qaRun = await getQaRunWithFindings(payload.qaRunId, payload.ownerId);
  if (
    !qaRun ||
    qaRun.run.status !== "running" ||
    qaRun.run.projectId !== payload.projectId ||
    qaRun.run.pageVersionId !== payload.pageVersionId
  ) {
    notFound();
    return null;
  }

  // Mismo project-full-fetch que el flujo normal (tokens/motionDna de la
  // dirección elegida), pero con el ownerId DEL TOKEN.
  const full = await getPixelforgeProjectFull(payload.projectId, payload.ownerId);
  if (!full) {
    notFound();
    return null;
  }

  const version = await getPageVersionById(payload.projectId, payload.pageVersionId, payload.ownerId);
  if (!version) {
    notFound();
    return null;
  }

  const chosen = full.project.chosenDirectionId
    ? full.directions.find((d) => d.id === full.project.chosenDirectionId)
    : undefined;
  const tokens: DesignTokens = chosen ? (chosen.designTokens as DesignTokens) : DEFAULT_PREVIEW_TOKENS;
  const motionDna = chosen?.motionDna as MotionDnaInput | undefined;

  const v = validatePageTree(version.tree);
  if (!v.ok) {
    // Misma lógica que la rama de sesión: la puerta ya corrió una vez en el
    // insert — que falle aquí es corrupción real de la fila.
    throw new Error(`La versión de QA está corrupta: ${v.errors.join(" | ")}`);
  }

  return <PageRenderer tree={v.tree} tokens={tokens} motionDna={motionDna} />;
}

export default async function PixelforgePreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ pfqa?: string }>;
}) {
  const { id } = await params;

  // Rama `?pfqa` (PF-F8 T3) — SIEMPRE antes del flujo de sesión. Con `pfqa`
  // ausente (el caso normal), esta línea no cambia nada del comportamiento de
  // siempre: `searchParams` puede incluso venir `undefined` (páginas que no
  // lo declaran en sus tests existentes).
  const pfqa = searchParams ? (await searchParams).pfqa : undefined;
  if (pfqa) {
    return renderQaPreview(id, pfqa);
  }

  const session = await auth();
  const ownerId = session?.user?.id;
  if (!ownerId) redirect("/login?redirect=/proyectos/pixelforge");

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
