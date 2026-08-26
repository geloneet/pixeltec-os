import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUserSession } from "@/lib/auth/session";
import { listBlogCategoriesWithUsage, listPostsInCategory } from "@/lib/blog-cms/queries";
import { ADMIN_BLOG_PATH } from "@/lib/blog-cms/paths";
import { CategoryPostsButton, DeleteCategoryButton, NewCategoryForm } from "@/components/blog/cms/category-form";
import PageHeader from "@/components/dashboard/PageHeader";

export const metadata: Metadata = { title: "Categorías del blog — PixelTEC OS" };
export const dynamic = "force-dynamic";

/** Categorías (paridad Encino `blog/categorias/page.tsx`): un nivel de
 *  jerarquía; los huérfanos (padre borrado) se muestran como raíz. */
export default async function BlogCmsCategoriesPage() {
  const session = await requireUserSession();
  if (!session) redirect(`/login?redirect=${ADMIN_BLOG_PATH}/categorias`);

  const categories = await listBlogCategoriesWithUsage();
  const ids = new Set(categories.map((c) => c.id));
  const topLevel = categories.filter((c) => !c.parentId || !ids.has(c.parentId));
  const childrenOf = (id: string) => categories.filter((c) => c.parentId === id);
  const used = categories.filter((c) => c.postCount > 0);
  const postsByCategory = new Map(
    await Promise.all(used.map(async (c) => [c.name, await listPostsInCategory(c.name)] as const)),
  );

  const Row = ({ c, depth }: { c: (typeof categories)[number]; depth: number }) => (
    <tr className="hover:bg-secondary/30">
      <td className="px-3 py-2" style={{ paddingLeft: `${12 + depth * 20}px` }}>
        <span className="font-medium">{depth > 0 ? "— " : ""}{c.name}</span>
        {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
      </td>
      <td className="px-3 py-2 text-muted-foreground">{c.slug || "—"}</td>
      <td className="px-3 py-2"><CategoryPostsButton name={c.name} count={c.postCount} posts={postsByCategory.get(c.name) ?? []} /></td>
      <td className="px-3 py-2 text-right"><DeleteCategoryButton category={c} /></td>
    </tr>
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <Link href={ADMIN_BLOG_PATH} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Blog
      </Link>
      <PageHeader title="Categorías" description="Catálogo de categorías del blog (un nivel de jerarquía)" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-3 py-2">Nombre</th><th className="px-3 py-2">Slug</th><th className="px-3 py-2">Entradas</th><th className="px-3 py-2 text-right">Acciones</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {categories.length === 0 && <tr><td colSpan={4} className="px-3 py-10 text-center text-muted-foreground">Aún no hay categorías.</td></tr>}
              {topLevel.map((c) => (
                <>
                  <Row key={c.id} c={c} depth={0} />
                  {childrenOf(c.id).map((ch) => <Row key={ch.id} c={ch} depth={1} />)}
                </>
              ))}
            </tbody>
          </table>
        </div>
        <NewCategoryForm parents={topLevel.map((c) => ({ id: c.id, name: c.name }))} />
      </div>
    </div>
  );
}
