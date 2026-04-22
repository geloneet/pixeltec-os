import { z } from "zod";

export const AlertConditionSchema = z.enum(["price_above", "price_below", "change_percent"]);
export const AlertChannelItemSchema = z.enum(["telegram", "dashboard"]);

export const CreateAlertSchema = z.object({
  symbol: z.string().min(1, "Selecciona un asset"),
  type: AlertConditionSchema,
  threshold: z.number().positive("El umbral debe ser mayor a cero"),
  pctWindow: z.enum(["1h", "24h", "7d"]).optional(), // only for change_percent
  pctDirection: z.enum(["up", "down"]).optional(),
  channels: z.array(AlertChannelItemSchema).min(1, "Selecciona al menos un canal"),
  telegramChatId: z.string().optional(),
  cooldownMinutes: z.number().int().min(5).max(1440),
  displayName: z.string().max(80).optional(),
});

export const UpdateAlertSchema = CreateAlertSchema.partial().extend({
  active: z.boolean().optional(),
});

export type CreateAlertInput = z.infer<typeof CreateAlertSchema>;
export type UpdateAlertInput = z.infer<typeof UpdateAlertSchema>;
