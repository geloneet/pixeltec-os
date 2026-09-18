import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireUserSession } from "@/lib/auth/session";
import { getPostById, getViewCounts } from "@/lib/blog/queries/posts";
import { listVersions } from "@/lib/blog/versions";
import { listBlogCategoryNames } from "@/lib/blog-cms/queries";
import { ADMIN_BLOG_PATH } from "@/lib/blog-cms/paths";
import { BlogCmsEditor } from "@/components/blog/cms/editor";

export const metadata: Metadata = { title: "Editar entrada — Blog — Pixeltec.mx" };
export const dynamic = "force-dynamic";

/** Editor (paridad Encino `blog/[id]/editar/page.tsx`): id no-UUID ⇒ 404;
 *  `?ia=1` abre el wizard. Sin `key` por `post.updatedAt` (WO-2026-00206): esa
 *  key forzaba un remontaje completo del editor en CUALQUIER revalidación de
 *  esta página `force-dynamic` (no solo al restaurar una revisión) — el App
 *  Router de Next.js puede revalidar el segmento en segundo plano (foco de
 *  pestaña, caché del router) sin que `post.updatedAt` cambie de valor; cada
 *  remontaje reiniciaba `aiOpen`/`step` del wizard «Con IA» y perdía el brief
 *  que el usuario llevaba escrito. `BlogCmsEditor` ahora resincroniza su
 *  estado tras «Restaurar revisión» sin remontarse (ver `restoringRef`). */
export default async function BlogCmsEditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireUserSession();
  if (!session) redirect(`/login?redirect=${ADMIN_BLOG_PATH}`);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sp = await searchParams;

  const post = await getPostById(id);
  if (!post) notFound();
  const [categories, versions, viewCounts] = await Promise.all([
    listBlogCategoryNames(),
    listVersions(post.id).catch(() => []),
    getViewCounts(),
  ]);
  // `blog_post_view_counts` se indexa por el uuid real de `blog_posts.id`; el
  // regex de arriba ya garantiza que `id` (el param de ruta) tiene esa forma,
  // así que se usa directo (WO-2026-00221).
  const viewCount = viewCounts[id] ?? 0;

  return (
    <BlogCmsEditor
      post={post}
      categories={categories}
      revisions={versions.slice(0, 10)}
      isAdmin={session.role === "admin"}
      startWithAi={sp.ia === "1"}
      viewCount={viewCount}
    />
  );
}
