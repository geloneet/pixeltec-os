import { db, COL } from "../firebase-admin";
import type { TelegramUser } from "../types";

export type TelegramUserWithId = TelegramUser & { docId: string };

export type TelegramUserSerialized = Omit<TelegramUserWithId, "createdAt"> & { createdAt: string };

export async function listAuthorizedUsers(): Promise<TelegramUserSerialized[]> {
  const snap = await db()
    .collection(COL.telegramUsers)
    .where("authorized", "==", true)
    .get();
  return snap.docs.map(d => {
    const data = d.data() as TelegramUser;
    const { createdAt, ...rest } = data;
    return { docId: d.id, ...rest, createdAt: createdAt.toDate().toISOString() };
  });
}
