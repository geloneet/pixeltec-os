import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { Bot, FolderTree, ImageIcon } from "lucide-react";
import { requireUserSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { formatEditorialDate } from "@/lib/blog/format-date";
import {
  countBlogCmsPostsByStatus,
  deleteAbandonedEmptyDrafts,
  listBlogCategoryNames,
  listBlogCmsMonths,
  listBlogCmsPosts,
  publishDueScheduledPosts,
  PAGE_SIZE,
  type BlogCmsStatusTab,
} from "@/lib/blog-cms/queries";
import { ADMIN_BLOG_PATH } from "@/lib/blog-cms/paths";
import { NewPostButton } from "@/components/blog/cms/new-post-button";
import { BlogCmsFilterBar } from "@/components/blog/cms/filter-bar";
import { PostRowActions } from "@/components/blog/cms/post-row-actions";
import { StatusPill } from "@/components/blog/cms/status-pill";
import PageHeader from "@/components/dashboard/PageHeader";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Blog — PixelTEC OS" };
export const dynamic = "force-dynamic";

/** `?estado=` (paridad Encino): '' Todas · publicadas · programadas · borradores · archivadas. */
const TABS: Array<{ key: string; label: string; status: BlogCmsStatusTab }> = [
  { key: "", label: "Todas", status: "all" },
  { key: "publicadas", label: "Publicadas", status: "published" },
  { key: "programadas", label: "Programadas", status: "scheduled" },
  { key: "borradores", label: "Borradores", status: "draft" },
  { key: "archivadas", label: "Archivadas", status: "archived" },
];

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

export default async function BlogCmsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireUserSession();
  if (!session) redirect(`/login?redirect=${ADMIN_BLOG_PATH}`);
  const sp = await searchParams;

  // Barrido en render (paridad Encino): publica programados vencidos y limpia
  // borradores vacíos abandonados antes de listar.
  await publishDueScheduledPosts().catch(() => []);
  await deleteAbandonedEmptyDrafts().catch(() => 0);

  const estado = one(sp.estado);
  const tab = TABS.find((t) => t.key === estado) ?? TABS[0];
  const categoria = one(sp.categoria).slice(0, 80);
  const fecha = one(sp.fecha);
  const q = one(sp.q).slice(0, 100);
  const page = Math.max(1, Number.parseInt(one(sp.page) || "1", 10) || 1);

  const [{ posts, total }, counts, categories, months] = await Promise.all([
    listBlogCmsPosts({ status: tab.status, category: categoria || undefined, month: /^\d{4}-\d{2}$/.test(fecha) ? fecha : undefined, search: q || undefined, page }),
    countBlogCmsPostsByStatus(),
    listBlogCategoryNames(),
    listBlogCmsMonths(),
  ]);
  const countFor = (t: BlogCmsStatusTab) =>
    t === "all" ? Object.values(counts).reduce((a, b) => a + b, 0)
    : t === "draft" ? (counts.draft ?? 0) + (counts["needs-review"] ?? 0) + (counts.approved ?? 0)
    : (counts[t] ?? 0);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const baseQuery = new URLSearchParams();
  if (estado) baseQuery.set("estado", estado);
  if (categoria) baseQuery.set("categoria", categoria);
  if (fecha) baseQuery.set("fecha", fecha);
  if (q) baseQuery.set("q", q);
  const pageHref = (p: number) => { const u = new URLSearchParams(baseQuery); if (p > 1) u.set("page", String(p)); const s = u.toString(); return `${ADMIN_BLOG_PATH}${s ? `?${s}` : ""}`; };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="Blog" description="Entradas del blog de pixeltec.mx" />
        <div className="flex items-center gap-2">
          <Link href={`${ADMIN_BLOG_PATH}/categorias`} className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm text-foreground hover:bg-secondary/60">
            <FolderTree className="h-4 w-4" /> Categorías
          </Link>
          <NewPostButton />
        </div>
      </div>

      <nav aria-label="Estado" className="mt-6 flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => {
          const active = t.key === tab.key;
          const u = new URLSearchParams(baseQuery); if (t.key) u.set("estado", t.key); else u.delete("estado");
          return (
            <Link key={t.key} href={`${ADMIN_BLOG_PATH}${u.toString() ? `?${u}` : ""}`} className={cn("border-b-2 px-3 py-2 text-sm", active ? "border-cyan-400 font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
              {t.label} <span className="ml-1 text-xs text-muted-foreground">{countFor(t.status)}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-4">
        <Suspense fallback={null}>
          <BlogCmsFilterBar categories={categories} months={months} />
        </Suspense>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 w-16">Portada</th>
              <th className="px-3 py-2">Entrada</th>
              <th className="px-3 py-2">Categoría</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {posts.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">No hay entradas con estos filtros.</td></tr>
            )}
            {posts.map((p) => (
              <tr key={p.id} className="hover:bg-secondary/30">
                <td className="px-3 py-2">
                  {p.coverImage ? (
                    <Image src={p.coverImage} alt="" width={48} height={32} className="h-8 w-12 rounded object-cover" unoptimized />
                  ) : (
                    <span className="flex h-8 w-12 items-center justify-center rounded bg-secondary/60 text-muted-foreground"><ImageIcon className="h-4 w-4" /></span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <Link href={`${ADMIN_BLOG_PATH}/${p.id}/editar`} className="font-medium text-foreground hover:text-cyan-400">
                    {p.title || <span className="italic text-muted-foreground">Sin título</span>}
                  </Link>
                  {p.aiParams && <Bot className="ml-1 inline h-3.5 w-3.5 text-cyan-400" aria-label="Generada con IA" />}
                  <p className="text-xs text-muted-foreground">{p.author.name} · {formatEditorialDate(p.publishedAt ?? p.updatedAt)}{p.status === "scheduled" && p.scheduledAt ? ` · programada ${formatEditorialDate(p.scheduledAt)}` : ""}</p>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{p.category || "—"}</td>
                <td className="px-3 py-2"><StatusPill status={p.status} /></td>
                <td className="px-3 py-2"><div className="flex justify-end"><PostRowActions id={p.id} slug={p.slug} status={p.status} title={p.title} /></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>Página {page} de {pages} · {total} entradas</span>
          <div className="flex gap-2">
            {page > 1 && <Link href={pageHref(page - 1)} className="rounded-md border border-border px-3 py-1 hover:bg-secondary/60">Anterior</Link>}
            {page < pages && <Link href={pageHref(page + 1)} className="rounded-md border border-border px-3 py-1 hover:bg-secondary/60">Siguiente</Link>}
          </div>
        </div>
      )}
    </div>
  );
}
