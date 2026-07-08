/**
 * Repo de notificaciones — Postgres/Drizzle. Ver src/lib/db/schema.ts.
 * Código nuevo, aislado — NO conectado a rutas reales todavía (Fase 0+1).
 */
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications, type NewNotification } from "@/lib/db/schema";

export function getNotificationsByUser(userId: string, limit = 50) {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export function createNotification(data: NewNotification) {
  return db.insert(notifications).values(data).returning().then((rows) => rows[0]);
}

export function markNotificationRead(id: string, userId: string) {
  return db
    .update(notifications)
    .set({ read: true, readAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
    .returning()
    .then((rows) => rows[0] ?? null);
}
