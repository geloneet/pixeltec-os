import { getViewCounts, listAllPosts } from "@/lib/blog/queries/posts";
import { listBriefs } from "@/lib/blog/actions/briefs";
import type { BlogPostSerialized, BlogBriefSerialized } from "@/lib/blog/types";
import { BlogAdminWorkspace } from "./blog-admin-workspace";
import { NewArticleMenu } from "./new-article-menu";

/**
 * Blog Admin (rediseño minimalista 2026-08-04): Server Component que carga los
 * datos con las MISMAS queries de siempre y delega la interacción (tabs,
 * búsqueda, filtros, acciones) al único Client Component de la página.
 */
export default async function BlogAdminPage() {
  let posts: BlogPostSerialized[] = [];
  let briefs: BlogBriefSerialized[] = [];
  let views: Record<string, number> = {};
  let fetchError: string | null = null;

  try {
    const [postsResult, briefsResult, viewsResult] = await Promise.all([
      listAllPosts(),
      listBriefs(),
      getViewCounts(),
    ]);
    posts = postsResult;
    briefs = briefsResult.ok ? (briefsResult.data ?? []) : [];
    views = viewsResult;
  } catch (err) {
    console.error("[blog-admin] data fetch error:", err);
    fetchError = err instanceof Error ? err.message : "Error al cargar datos";
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Encabezado compacto: un título, una línea, un CTA */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Blog</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestiona ideas, borradores y publicaciones.
          </p>
        </div>
        <NewArticleMenu />
      </div>

      {fetchError && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
          Error al cargar datos: {fetchError}. Reintenta en unos segundos.
        </div>
      )}

      {/* El resumen editorial (contadores pulsables) vive dentro del workspace
          para poder aplicar filtros al pulsarlos. */}
      <BlogAdminWorkspace posts={posts} briefs={briefs} views={views} />
    </div>
  );
}
