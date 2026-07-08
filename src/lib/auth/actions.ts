"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export type ChangePasswordResult =
  | { ok: true }
  | { ok: false; error: "no-session" | "wrong-password" | "too-short" | "unknown" };

/**
 * Cambia la contraseña del usuario autenticado (reemplaza el flujo de
 * Firebase `reauthenticateWithCredential` + `updatePassword` — Fase 2 de la
 * migración). Verifica la contraseña actual contra `users.passwordHash`
 * antes de aceptar la nueva.
 */
export async function changePasswordAction(
  currentPassword: string,
  newPassword: string
): Promise<ChangePasswordResult> {
  if (!currentPassword || !newPassword) return { ok: false, error: "unknown" };
  if (newPassword.length < 8) return { ok: false, error: "too-short" };

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "no-session" };

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return { ok: false, error: "no-session" };

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) return { ok: false, error: "wrong-password" };

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, userId));

  return { ok: true };
}
