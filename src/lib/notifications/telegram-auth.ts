import { db } from '@/lib/assistant/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

export const TELEGRAM_COL = {
  silences:   'infraSilences',
  commandLog: 'infraCommandLog',
};

export function isAllowedChat(chatId: number | string): boolean {
  const allowed = process.env.TELEGRAM_INFRA_CHAT_ID;
  if (!allowed) return false;
  return String(chatId) === String(allowed);
}

export async function logCommand(opts: {
  command: string;
  args?: string;
  chatId: number;
  username?: string;
  result: 'ok' | 'denied' | 'error';
  durationMs?: number;
  errorMessage?: string;
}): Promise<void> {
  try {
    await db().collection(TELEGRAM_COL.commandLog).add({
      command:      opts.command,
      args:         opts.args ?? null,
      chatId:       String(opts.chatId),
      username:     opts.username ?? null,
      executedAt:   Timestamp.now(),
      result:       opts.result,
      durationMs:   opts.durationMs ?? null,
      errorMessage: opts.errorMessage ?? null,
    });
  } catch (err) {
    console.error('[telegram-auth] logCommand failed:', err);
  }
}
