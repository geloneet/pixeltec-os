'use server';

// Fase 4 (rebanada Blog): Postgres — antes Firestore `blogPosts`.
// Migración one-off del body de un post ya publicado (limpieza de
// frontmatter). Se conserva funcional porque sigue expuesta en
// /blog-admin/migrate-post.
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { blogPosts } from '@/lib/db/schema';
import { getSessionUid } from '@/lib/crypto-intel/auth';
import type { ActionResult } from '../schemas';

function stripCodeFenceWrapper(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/^```(?:markdown|md)?\s*\n([\s\S]*)\n```\s*$/);
  return match ? match[1] : trimmed;
}

function parseFrontMatter(raw: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return result;
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    if (value.startsWith('[') && value.endsWith(']')) {
      result[key] = value
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    } else {
      result[key] = value.replace(/^["']|["']$/g, '');
    }
  }
  return result;
}

function extractBody(raw: string): string {
  return raw.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, '').trim();
}

const ALLOWED_CATEGORIES = ['arquitectura', 'automatización', 'case-study', 'opinión'];
const TARGET_SLUG = 'como-tomar-un-curso-de-ia-gratis';

export async function migrateExistingPostBody(): Promise<ActionResult<{ before: number; after: number }>> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: 'No autenticado' };

  const [row] = await db.select().from(blogPosts).where(eq(blogPosts.slug, TARGET_SLUG)).limit(1);
  if (!row) return { ok: false, error: `Post no encontrado: ${TARGET_SLUG}` };

  const originalBody = row.body;

  const unwrapped = stripCodeFenceWrapper(originalBody).replace(/\r\n/g, '\n');
  const frontMatter = parseFrontMatter(unwrapped);
  const cleanBody = extractBody(unwrapped);

  const briefSource = row.briefSource as Record<string, unknown>;
  const update: Partial<typeof blogPosts.$inferInsert> = {
    body: cleanBody,
    updatedAt: new Date(),
  };

  // Populate fields from frontmatter only when current values are empty/fallback.
  if (frontMatter.title && (!row.title || row.title === briefSource.topic)) {
    update.title = String(frontMatter.title);
  }
  if (frontMatter.excerpt && !row.excerpt) {
    update.excerpt = String(frontMatter.excerpt).slice(0, 160);
  }
  if (Array.isArray(frontMatter.tags) && frontMatter.tags.length > 0 && !row.tags.length) {
    update.tags = frontMatter.tags as string[];
  }
  if (
    frontMatter.category &&
    ALLOWED_CATEGORIES.includes(String(frontMatter.category)) &&
    row.category === 'arquitectura'
  ) {
    update.category = String(frontMatter.category);
  }

  await db.update(blogPosts).set(update).where(eq(blogPosts.id, row.id));

  revalidatePath(`/blog/${TARGET_SLUG}`);
  revalidatePath('/blog');

  return { ok: true, data: { before: originalBody.length, after: cleanBody.length } };
}
