import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireUserSession } from "@/lib/auth/session";
import { getPostById } from "@/lib/blog/queries/posts";
import { listVersions } from "@/lib/blog/versions";
import { listBlogCategoryNames } from "@/lib/blog-cms/queries";
import { ADMIN_BLOG_PATH } from "@/lib/blog-cms/paths";
import { BlogCmsEditor } from "@/components/blog/cms/editor";

export const metadata: Metadata = { title: "Editar entrada — Blog — PixelTEC OS" };
export const dynamic = "force-dynamic";

/** Editor (paridad Encino `blog/[id]/editar/page.tsx`): id no-UUID ⇒ 404;
 *  `?ia=1` abre el wizard; `key` por updatedAt fuerza remontar tras restaurar. */
export default async function BlogCmsEditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireUserSession();
  if (!session) redirect(`/login?redirect=${ADMIN_BLOG_PATH}`);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sp = await searchParams;

  const post = await getPostById(id);
  if (!post) notFound();
  const [categories, versions] = await Promise.all([
    listBlogCategoryNames(),
    listVersions(post.id).catch(() => []),
  ]);

  return (
    <BlogCmsEditor
      key={post.updatedAt}
      post={post}
      categories={categories}
      revisions={versions.slice(0, 10)}
      isAdmin={session.role === "admin"}
      startWithAi={sp.ia === "1"}
    />
  );
}
