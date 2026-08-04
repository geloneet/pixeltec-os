import { NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { blogPosts, blogPostViewCounts } from '@/lib/db/schema';
import { SLUG_RE } from '@/lib/blog/publication-gate';

/**
 * Beacon público de visitas (GO "vistas blog" 2026-08-04): suma 1 a la métrica
 * del artículo publicado. NO persiste nada del visitante (ni IP, ni cookies,
 * ni user-agent) — solo un contador por post. Métrica orientativa: bots que
 * ejecutan JS pueden inflarla; la métrica seria es GSC.
 *
 * Fail-silent a propósito: un slug inexistente responde ok (no filtra qué
 * slugs existen) y un fallo de DB jamás rompe la lectura del artículo.
 */
export async function POST(req: Request) {
  let slug: unknown;
  try {
    ({ slug } = (await req.json()) as { slug?: unknown });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (typeof slug !== 'string' || slug.length > 120 || !SLUG_RE.test(slug)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    const [row] = await db
      .select({ id: blogPosts.id })
      .from(blogPosts)
      .where(and(eq(blogPosts.slug, slug), eq(blogPosts.status, 'published')))
      .limit(1);

    if (row) {
      await db
        .insert(blogPostViewCounts)
        .values({ postId: row.id, views: 1 })
        .onConflictDoUpdate({
          target: blogPostViewCounts.postId,
          set: { views: sql`${blogPostViewCounts.views} + 1`, updatedAt: new Date() },
        });
    }
  } catch (err) {
    console.error('[blog/view] increment failed:', err);
  }
  return NextResponse.json({ ok: true });
}
