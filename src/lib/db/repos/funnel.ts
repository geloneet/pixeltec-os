/**
 * Repo del funnel público (leads/newsletter) — Postgres/Drizzle.
 * Ver src/lib/db/schema.ts. Código nuevo, aislado — NO conectado a rutas
 * reales todavía (Fase 0+1).
 */
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads, newsletterSubscribers, type NewLead } from "@/lib/db/schema";

export function createLead(data: NewLead) {
  return db.insert(leads).values(data).returning().then((rows) => rows[0]);
}

export function getSubscriberByEmail(email: string) {
  return db
    .select()
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.email, email.toLowerCase().trim()))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}
