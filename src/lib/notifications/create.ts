/**
 * Escritura de notificaciones — módulo server-only, deliberadamente FUERA de
 * un boundary `"use server"`.
 *
 * Vivía en `actions.ts`, y eso la convertía en una server action invocable
 * desde el navegador: sin sesión, para cualquier `userId`, con `title`, `body`
 * y `href` arbitrarios y un `source` capaz de suplantar orígenes de confianza
 * ("daily-cron", "proposal-decision"). Al no llevar la directiva, aquí solo
 * puede llamarla código de servidor por import directo — los crons y las rutas
 * API que ya derivan el destinatario de datos propios.
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
