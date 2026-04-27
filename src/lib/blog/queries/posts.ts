import { getFirestore } from 'firebase-admin/firestore';
import { getAdminApp } from '@/lib/firebase-admin';
import type { BlogPostSerialized, BlogPostStatus } from '../types';

function db() {
  return getFirestore(getAdminApp());
}

function serializePost(id: string, d: FirebaseFirestore.DocumentData): BlogPostSerialized {
  return {
    id,
    slug: d.slug ?? '',
    title: d.title ?? '',
    excerpt: d.excerpt ?? '',
    body: d.body ?? '',
    category: d.category ?? 'arquitectura',
    tags: d.tags ?? [],
    coverImage: d.coverImage ?? null,
    author: d.author ?? { name: 'Admin', uid: '' },
    status: d.status ?? 'draft',
    briefSource: d.briefSource ?? { topic: '', angle: '', targetAudience: '', keyPoints: [], tone: '' },
    ai: {
      model: d.ai?.model ?? '',
      generatedAt: d.ai?.generatedAt?.toDate().toISOString() ?? new Date().toISOString(),
      editedByHuman: d.ai?.editedByHuman ?? false,
      wordsAdded: d.ai?.wordsAdded ?? 0,
      iterations: d.ai?.iterations ?? 1,
    },
    seo: d.seo ?? { metaTitle: '', metaDescription: '', canonicalUrl: null, noindex: true },
    wordCount: d.wordCount ?? 0,
    readingTimeMin: d.readingTimeMin ?? 1,
    createdAt: d.createdAt?.toDate().toISOString() ?? new Date().toISOString(),
    updatedAt: d.updatedAt?.toDate().toISOString() ?? new Date().toISOString(),
    publishedAt: d.publishedAt?.toDate().toISOString() ?? null,
    approvedBy: d.approvedBy ?? null,
  };
}

export async function getPublishedPosts(): Promise<BlogPostSerialized[]> {
  const snap = await db()
    .collection('blogPosts')
    .where('status', '==', 'published')
    .where('seo.noindex', '==', false)
    .orderBy('publishedAt', 'desc')
    .get();

  return snap.docs.map((doc) => serializePost(doc.id, doc.data()));
}

export async function getPublishedPostBySlug(slug: string): Promise<BlogPostSerialized | null> {
  const snap = await db()
    .collection('blogPosts')
    .where('slug', '==', slug)
    .where('status', '==', 'published')
    .where('seo.noindex', '==', false)
    .limit(1)
    .get();

  if (snap.empty) return null;
  const doc = snap.docs[0];
  return serializePost(doc.id, doc.data());
}

export async function getPostBySlug(slug: string): Promise<BlogPostSerialized | null> {
  const snap = await db()
    .collection('blogPosts')
    .where('slug', '==', slug)
    .where('status', '==', 'published')
    .limit(1)
    .get();

  if (snap.empty) return null;
  const doc = snap.docs[0];
  return serializePost(doc.id, doc.data());
}

export async function getPostById(postId: string): Promise<BlogPostSerialized | null> {
  const snap = await db().collection('blogPosts').doc(postId).get();
  if (!snap.exists) return null;
  return serializePost(snap.id, snap.data()!);
}

export async function listAllPosts(statusFilter?: BlogPostStatus[]): Promise<BlogPostSerialized[]> {
  let query: FirebaseFirestore.Query = db().collection('blogPosts').orderBy('createdAt', 'desc');

  if (statusFilter && statusFilter.length > 0) {
    query = query.where('status', 'in', statusFilter);
  }

  const snap = await query.limit(100).get();
  return snap.docs.map((doc) => serializePost(doc.id, doc.data()));
}
