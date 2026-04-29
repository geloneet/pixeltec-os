import { z } from 'zod';

export const AlertSeveritySchema = z.enum(['info', 'warn', 'error', 'critical']);
export type AlertSeverity = z.infer<typeof AlertSeveritySchema>;

export const AlertPayloadSchema = z.object({
  source: z.string().min(1).max(64),
  severity: AlertSeveritySchema,
  title: z.string().min(1).max(120),
  message: z.string().min(1).max(2000),
  metadata: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export type AlertPayload = z.infer<typeof AlertPayloadSchema>;

export interface AlertResponse {
  ok: boolean;
  sent: boolean;
  reason?: string;
  messageId?: number;
}

import type { Timestamp } from 'firebase-admin/firestore';

export interface InfraSilenceDoc {
  id: string;
  silencedBy: string;
  reason?: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  source?: string;
}

export interface InfraCommandLogDoc {
  id: string;
  command: string;
  args?: string;
  chatId: string;
  username?: string;
  executedAt: Timestamp;
  result: 'ok' | 'denied' | 'error';
  durationMs?: number;
  errorMessage?: string;
}
