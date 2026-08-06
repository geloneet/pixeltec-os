"use server";

import { and, desc, eq } from "drizzle-orm";
import { getSessionUserId } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { type Notification } from "./schemas";

// `createNotification` se mudó a ./create.ts (server-only, SIN "use server").
// Aquí era una action invocable desde el navegador sin sesión, capaz de
// insertar notificaciones para cualquier userId con href y source arbitrarios.
// Las tres funciones de abajo sí verifican sesión y se quedan.

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

// Las tres actions resuelven identidad con `getSessionUserId()`, que aplica la
// autoridad canónica (cuenta existente y activa, credenciales no revocadas).
// Con `auth()` a secas, una cuenta suspendida o una cookie anterior a un
// cambio de contraseña seguían leyendo y marcando notificaciones (ADR-0036).

/** Últimas notificaciones del usuario de la sesión (reemplaza el onSnapshot del cliente). */
export async function getMyNotifications(limit = 20): Promise<Notification[]> {
  const userId = await getSessionUserId();
  if (!userId) return [];

  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);

  return rows.map(serialize);
}

export async function markNotificationReadAction(id: string): Promise<void> {
  const userId = await getSessionUserId();
  if (!userId) return;

  await db
    .update(notifications)
    .set({ read: true, readAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const userId = await getSessionUserId();
  if (!userId) return;

  await db
    .update(notifications)
    .set({ read: true, readAt: new Date() })
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
}
