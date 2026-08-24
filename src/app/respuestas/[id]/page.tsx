import { notFound, redirect } from "next/navigation";
import { resolveRespuesta } from "@/lib/respuestas/resolver";

/**
 * /respuestas/[id] — ruta pública genérica de resolución (D-22).
 *
 * Es el destino del botón «Ver respuesta» de la plantilla de WhatsApp
 * `nueva_respuesta_cuestionario` (base aprobada por Meta:
 * https://pixeltec.mx/respuestas/). No renderiza nada: resuelve el id a la
 * vista de detalle interna y redirige. La vista destino conserva su propia
 * autenticación (p. ej. /smilemore-respuestas es ruta admin: el middleware
 * manda a /login?redirect=<destino> si no hay sesión). Id no reconocido ⇒ 404.
 */

export const dynamic = "force-dynamic";

export default async function RespuestaResolverPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const resolution = await resolveRespuesta(id);
  if (resolution.kind === "not-found") notFound();
  redirect(resolution.href);
}
