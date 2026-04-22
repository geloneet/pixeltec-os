"use server";
import { revalidatePath } from "next/cache";
import { Timestamp } from "firebase-admin/firestore";
import { db, COL } from "../firebase-admin";
import { requireAdmin } from "../auth";
import { AddTelegramUserSchema } from "../schemas/user";
import type { AddTelegramUserInput } from "../schemas/user";

export async function addAuthorizedUser(
  input: AddTelegramUserInput
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();

  const parsed = AddTelegramUserSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Datos inválidos" };
  }

  const { telegramId, firstName, role } = parsed.data;

  await db().collection(COL.telegramUsers).doc(telegramId).set({
    telegramUserId: parseInt(telegramId, 10),
    firstName: firstName ?? null,
    timezone: "America/Mexico_City",
    role,
    authorized: true,
    createdAt: Timestamp.now(),
  }, { merge: true });

  revalidatePath("/crypto-intel/admin");
  return { ok: true };
}

export async function deauthorizeUser(
  telegramId: string
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();

  await db().collection(COL.telegramUsers).doc(telegramId).update({
    authorized: false,
  });

  revalidatePath("/crypto-intel/admin");
  return { ok: true };
}
