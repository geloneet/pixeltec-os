import { z } from "zod";

export const NotificationTypeSchema = z.enum([
  "info",
  "success",
  "warning",
  "error",
  "alert",
]);
export type NotificationType = z.infer<typeof NotificationTypeSchema>;

export const NotificationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: NotificationTypeSchema,
  title: z.string(),
  body: z.string(),
  href: z.string().optional(),
  source: z.string(),
  read: z.boolean(),
  createdAt: z.unknown(),
  readAt: z.unknown().nullable(),
  metadata: z.record(z.unknown()).optional(),
});
export type Notification = z.infer<typeof NotificationSchema>;

export const CreateNotificationInputSchema = z.object({
  userId: z.string().min(1),
  type: NotificationTypeSchema,
  title: z.string().min(1),
  body: z.string().min(1),
  href: z.string().optional(),
  source: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});
export type CreateNotificationInput = z.infer<typeof CreateNotificationInputSchema>;
