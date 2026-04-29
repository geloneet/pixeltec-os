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
