import { db, COL } from "../firebase-admin";
import type { TelegramUser } from "../types";

export type TelegramUserWithId = TelegramUser & { docId: string };

export async function listAuthorizedUsers(): Promise<TelegramUserWithId[]> {
  const snap = await db()
    .collection(COL.telegramUsers)
    .where("authorized", "==", true)
    .get();
  return snap.docs.map(d => ({ docId: d.id, ...(d.data() as TelegramUser) }));
}
