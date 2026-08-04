import Link from "next/link";
import { listAllPosts } from "@/lib/blog/queries/posts";
import { listBriefs } from "@/lib/blog/actions/briefs";
import type { BlogPostSerialized, BlogBriefSerialized } from "@/lib/blog/types";
import { editorialSummary } from "./blog-admin-logic";
import { BlogAdminWorkspace } from "./blog-admin-workspace";

/**
 * Blog Admin (rediseño minimalista 2026-08-04): Server Component que carga los
 * datos con las MISMAS queries de siempre y delega la interacción (tabs,
 * búsqueda, filtros, acciones) al único Client Component de la página.
 */
export default async function BlogAdminPage() {
  let posts: BlogPostSerialized[] = [];
  let briefs: BlogBriefSerialized[] = [];
  let fetchError: string | null = null;

  try {
    const [postsResult, briefsResult] = await Promise.all([
      listAllPosts(),
      listBriefs(),
    ]);
    posts = postsResult;
    briefs = briefsResult.ok ? (briefsResult.data ?? []) : [];
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
        <Link
          href="/blog-admin/nuevo"
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-500 md:h-10"
        >
          + Nuevo brief
        </Link>
      </div>

      {fetchError && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
          Error al cargar datos: {fetchError}. Reintenta en unos segundos.
        </div>
      )}

      {/* Resumen editorial compacto — sustituye a las tarjetas KPI */}
      <p className="text-sm text-muted-foreground">{editorialSummary(posts)}</p>

      <BlogAdminWorkspace posts={posts} briefs={briefs} />
    </div>
  );
}
