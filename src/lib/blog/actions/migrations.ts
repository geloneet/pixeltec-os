'use server';

import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAdminApp } from '@/lib/firebase-admin';
import { getSessionUid } from '@/lib/crypto-intel/auth';
import { revalidatePath } from 'next/cache';
import type { ActionResult } from '../schemas';

function db() {
  return getFirestore(getAdminApp());
}

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

  const snap = await db()
    .collection('blogPosts')
    .where('slug', '==', TARGET_SLUG)
    .limit(1)
    .get();

  if (snap.empty) return { ok: false, error: `Post no encontrado: ${TARGET_SLUG}` };

  const doc = snap.docs[0];
  const data = doc.data();
  const originalBody = data.body as string;

  const unwrapped = stripCodeFenceWrapper(originalBody).replace(/\r\n/g, '\n');
  const frontMatter = parseFrontMatter(unwrapped);
  const cleanBody = extractBody(unwrapped);

  const update: Record<string, unknown> = {
    body: cleanBody,
    updatedAt: FieldValue.serverTimestamp(),
  };

  // Populate doc fields from frontmatter only when current values are empty/fallback.
  if (frontMatter.title && (!data.title || data.title === data.briefSource?.topic)) {
    update.title = String(frontMatter.title);
  }
  if (frontMatter.excerpt && (!data.excerpt || data.excerpt === '')) {
    update.excerpt = String(frontMatter.excerpt).slice(0, 160);
  }
  if (Array.isArray(frontMatter.tags) && frontMatter.tags.length > 0 && (!data.tags?.length)) {
    update.tags = frontMatter.tags;
  }
  if (
    frontMatter.category &&
    ALLOWED_CATEGORIES.includes(String(frontMatter.category)) &&
    data.category === 'arquitectura'
  ) {
    update.category = String(frontMatter.category);
  }

  await doc.ref.update(update);

  revalidatePath(`/blog/${TARGET_SLUG}`);
  revalidatePath('/blog');

  return { ok: true, data: { before: originalBody.length, after: cleanBody.length } };
}
