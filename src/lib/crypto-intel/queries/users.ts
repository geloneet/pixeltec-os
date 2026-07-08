import { listAuthorizedTelegramUsers } from "@/lib/db/repos/crypto-intel";
import type { TelegramUser } from "../types";

export type TelegramUserWithId = TelegramUser & { docId: string };

export type TelegramUserSerialized = Omit<TelegramUserWithId, "createdAt"> & { createdAt: string };

export async function listAuthorizedUsers(): Promise<TelegramUserSerialized[]> {
  const rows = await listAuthorizedTelegramUsers();
  return rows.map((row) => ({
    docId: row.telegramId,
    telegramUserId: row.telegramUserId,
    telegramUsername: row.telegramUsername ?? undefined,
    firstName: row.firstName ?? undefined,
    timezone: row.timezone,
    role: row.role,
    authorized: row.authorized,
    createdAt: row.createdAt.toISOString(),
  }));
}
