import { z } from "zod";

export const AddTelegramUserSchema = z.object({
  telegramId: z.string().regex(/^\d+$/, "Debe ser un número").min(5).max(15),
  firstName: z.string().min(1).max(80).optional(),
  role: z.enum(["owner", "operator"]).default("operator"),
});

export type AddTelegramUserInput = z.infer<typeof AddTelegramUserSchema>;
