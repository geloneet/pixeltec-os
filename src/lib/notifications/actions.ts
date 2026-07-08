"use server";

import { and, desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import {
  CreateNotificationInputSchema,
  type CreateNotificationInput,
  type Notification,
} from "./schemas";

/**
 * Fase 4: Postgres/Drizzle — antes Firestore `notifications`.
 * `userId` es el uuid de la tabla `users` (los crons iteran usuarios de
 * Postgres y pasan `u.id` directo, ya no el Firebase UID puente).
 */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  const parsed = CreateNotificationInputSchema.parse(input);

  await db.insert(notifications).values({
    userId: parsed.userId,
    type: parsed.type,
    title: parsed.title,
    body: parsed.body,
    href: parsed.href ?? null,
    source: parsed.source,
    metadata: parsed.metadata ?? {},
  });
}

type Row = typeof notifications.$inferSelect;

function serialize(r: Row): Notification {
  return {
    id: r.id,
    userId: r.userId,
    type: r.type,
    title: r.title,
    body: r.body,
    href: r.href ?? undefined,
    source: r.source,
    read: r.read,
    createdAt: r.createdAt.toISOString(),
    readAt: r.readAt?.toISOString() ?? null,
    metadata: (r.metadata ?? {}) as Record<string, unknown>,
  };
}

/** Últimas notificaciones del usuario de la sesión (reemplaza el onSnapshot del cliente). */
export async function getMyNotifications(limit = 20): Promise<Notification[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, session.user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);

  return rows.map(serialize);
}

export async function markNotificationReadAction(id: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;

  await db
    .update(notifications)
    .set({ read: true, readAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.userId, session.user.id)));
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;

  await db
    .update(notifications)
    .set({ read: true, readAt: new Date() })
    .where(and(eq(notifications.userId, session.user.id), eq(notifications.read, false)));
}
