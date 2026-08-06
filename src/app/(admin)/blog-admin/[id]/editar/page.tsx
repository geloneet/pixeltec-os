import { notFound } from "next/navigation";
import { getPostById } from "@/lib/blog/queries/posts";
import { getBlogActivityRows, type BlogActivityEntry } from "@/lib/blog/activity";
import { resolvePostRow } from "@/lib/blog/pg";
import { PostEditorClient } from "./post-editor-client";

interface Props {
  params: Promise<{ id: string }>;
}

/** El comentario de una devolución acompaña al autor mientras el post siga en
 *  borrador: es «devolución vigente» solo si es el evento de flujo más
 *  reciente (un nuevo envío/aprobación la apaga). Fire-safe: si el historial
 *  no está disponible (tabla aún sin migrar), el editor abre sin banner. */
const FLOW_TYPES = new Set(["devuelto", "enviado-a-revision", "aprobado", "publicado", "archivado"]);

export default async function EditarPostPage({ params }: Props) {
  const { id } = await params;
  const post = await getPostById(id);

  if (!post) notFound();

  // Historial editorial (etapa Verificar) — SIEMPRE se intenta cargar,
  // fire-safe: si la tabla no existe aún o falla la query, el editor abre
  // con historial vacío y sin banner.
  let activity: BlogActivityEntry[] = [];
  try {
    // blog_activity referencia el uuid de PG; post.id puede ser el id
    // público legacy (firestore) — se resuelve la fila real primero.
    const row = await resolvePostRow(id);
    if (row) activity = await getBlogActivityRows(row.id, 20);
  } catch {
    // Historial no disponible aún.
  }

  let lastReturn: { message: string; actorName: string | null; createdAt: string } | null = null;
  if (post.status === "draft") {
    const lastFlow = activity.find((r) => FLOW_TYPES.has(r.type));
    if (lastFlow?.type === "devuelto") {
      lastReturn = { message: lastFlow.message, actorName: lastFlow.actorName, createdAt: lastFlow.createdAt };
    }
  }

  return <PostEditorClient post={post} lastReturn={lastReturn} activity={activity} />;
}
