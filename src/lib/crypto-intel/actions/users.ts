"use server";
import { revalidatePath } from "next/cache";
import { deauthorizeTelegramUser, upsertTelegramUser } from "@/lib/db/repos/crypto-intel";
import { requireAdmin } from "@/lib/auth/session";
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

  await upsertTelegramUser({
    telegramId,
    telegramUserId: parseInt(telegramId, 10),
    firstName: firstName ?? null,
    timezone: "America/Mexico_City",
    role,
    authorized: true,
  });

  revalidatePath("/crypto-intel/admin");
  return { ok: true };
}

export async function deauthorizeUser(
  telegramId: string
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();

  await deauthorizeTelegramUser(telegramId);

  revalidatePath("/crypto-intel/admin");
  return { ok: true };
}
