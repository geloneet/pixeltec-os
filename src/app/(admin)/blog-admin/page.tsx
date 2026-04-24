import Link from "next/link";
import { listAllPosts } from "@/lib/blog/queries/posts";
import { listBriefs } from "@/lib/blog/actions/briefs";
import { cn } from "@/lib/utils";
import type { BlogPostStatus, BlogBriefStatus } from "@/lib/blog/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + "…" : str;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatWordCount(n: number): string {
  return new Intl.NumberFormat("es-MX").format(n) + " palabras";
}

// ─── Status badges ─────────────────────────────────────────────────────────────

const POST_STATUS_LABEL: Record<BlogPostStatus, string> = {
  draft: "Borrador",
  "needs-review": "Revisión",
  approved: "Aprobado",
  published: "Publicado",
  archived: "Archivado",
};

const POST_STATUS_CLASS: Record<BlogPostStatus, string> = {
  draft: "bg-zinc-700 text-zinc-300",
  "needs-review": "bg-yellow-500/20 text-yellow-300",
  approved: "bg-blue-500/20 text-blue-300",
  published: "bg-green-500/20 text-green-300",
  archived: "bg-zinc-800 text-zinc-500",
};

const BRIEF_STATUS_LABEL: Record<BlogBriefStatus, string> = {
  pending: "Pendiente",
  generating: "Generando",
  generated: "Generado",
  discarded: "Descartado",
};

const BRIEF_STATUS_CLASS: Record<BlogBriefStatus, string> = {
  pending: "bg-zinc-700 text-zinc-300",
  generating: "bg-yellow-500/20 text-yellow-300",
  generated: "bg-green-500/20 text-green-300",
  discarded: "bg-zinc-800 text-zinc-500",
};

function PostStatusBadge({ status }: { status: BlogPostStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        POST_STATUS_CLASS[status],
      )}
    >
      {POST_STATUS_LABEL[status]}
    </span>
  );
}

function BriefStatusBadge({ status }: { status: BlogBriefStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        BRIEF_STATUS_CLASS[status],
      )}
    >
      {BRIEF_STATUS_LABEL[status]}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function BlogAdminPage() {
  const [postsResult, briefsResult] = await Promise.all([
    listAllPosts(),
    listBriefs(),
  ]);

  const posts = Array.isArray(postsResult) ? postsResult : [];
  const briefs = Array.isArray(briefsResult) ? briefsResult : briefsResult?.data ?? [];

  const totalPosts = posts.length;
  const publishedCount = posts.filter((p) => p.status === "published").length;
  const needsReviewCount = posts.filter((p) => p.status === "needs-review").length;

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Blog Admin</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Gestiona borradores, revisiones y publicaciones del blog.
          </p>
        </div>
        <Link
          href="/blog-admin/nuevo"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
        >
          + Nuevo brief
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4 text-center">
          <p className="text-2xl font-bold text-zinc-100">{totalPosts}</p>
          <p className="mt-1 text-xs text-zinc-500">Posts totales</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{publishedCount}</p>
          <p className="mt-1 text-xs text-zinc-500">Publicados</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4 text-center">
          <p className="text-2xl font-bold text-yellow-400">{needsReviewCount}</p>
          <p className="mt-1 text-xs text-zinc-500">En revisión</p>
        </div>
      </div>

      {/* Main content: Posts (70%) + Briefs (30%) */}
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Posts section — 70% */}
        <section className="min-w-0 flex-[7]">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-zinc-500">
            Posts
          </h2>
          <div className="rounded-xl border border-white/5 bg-white/[0.03] overflow-hidden">
            {posts.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-zinc-500">
                No hay posts todavía. Crea un brief para generar el primero.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-white/5 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                      <th className="px-4 py-3">Título</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-4 py-3 hidden md:table-cell">Palabras</th>
                      <th className="px-4 py-3 hidden sm:table-cell">Fecha</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {posts.map((post) => (
                      <tr
                        key={post.id}
                        className="transition-colors hover:bg-white/[0.02]"
                      >
                        <td className="px-4 py-3 text-zinc-200">
                          {truncate(post.title, 60)}
                        </td>
                        <td className="px-4 py-3">
                          <PostStatusBadge status={post.status} />
                        </td>
                        <td className="px-4 py-3 text-zinc-400 hidden md:table-cell">
                          {formatWordCount(post.wordCount)}
                        </td>
                        <td className="px-4 py-3 text-zinc-400 hidden sm:table-cell">
                          {formatDate(post.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/blog-admin/${post.id}/editar`}
                            className="rounded-md px-3 py-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 transition-colors"
                          >
                            Editar
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* Briefs section — 30% */}
        <section className="min-w-0 flex-[3]">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
              Briefs pendientes
            </h2>
            <Link
              href="/blog-admin/nuevo"
              className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
            >
              + Nuevo
            </Link>
          </div>
          <div className="rounded-xl border border-white/5 bg-white/[0.03] divide-y divide-white/5">
            {briefs.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-zinc-500">
                No hay briefs activos.
              </p>
            ) : (
              briefs.map((brief) => (
                <div key={brief.id} className="px-4 py-3 space-y-1">
                  <p className="text-sm text-zinc-200 truncate">
                    {truncate(brief.topic, 40)}
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <BriefStatusBadge status={brief.status} />
                    <span className="text-xs text-zinc-500">
                      {formatDate(brief.createdAt)}
                    </span>
                  </div>
                  {brief.status === "generated" && brief.generatedDraftId && (
                    <Link
                      href={`/blog-admin/${brief.generatedDraftId}/editar`}
                      className="inline-block text-xs font-medium text-green-400 hover:text-green-300 transition-colors"
                    >
                      Ver borrador →
                    </Link>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
