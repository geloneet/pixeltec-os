/**
 * Repo de blog — Postgres/Drizzle. Ver src/lib/db/schema.ts.
 * Código nuevo, aislado — NO conectado a rutas reales todavía (Fase 0+1).
 */
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { blogPosts, type NewBlogPost } from "@/lib/db/schema";

export function getPublishedPosts() {
  return db
    .select()
    .from(blogPosts)
    .where(eq(blogPosts.status, "published"))
    .orderBy(desc(blogPosts.publishedAt));
}

export function getPostBySlug(slug: string) {
  return db
    .select()
    .from(blogPosts)
    .where(and(eq(blogPosts.slug, slug), eq(blogPosts.status, "published")))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

export function createBlogPost(data: NewBlogPost) {
  return db.insert(blogPosts).values(data).returning().then((rows) => rows[0]);
}
