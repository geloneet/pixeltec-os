/**
 * Escritura de notificaciones — módulo server-only, deliberadamente FUERA de
 * un boundary "use server": vivía en actions.ts y eso la convertía en una
 * server action invocable desde el navegador sin sesión, capaz de insertar
 * notificaciones para cualquier userId con título/href arbitrarios. Aquí solo
 * puede llamarla código de servidor (crons, rutas API) por import directo.
 */
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { CreateNotificationInputSchema, type CreateNotificationInput } from "./schemas";

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
