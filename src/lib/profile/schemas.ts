import { z } from "zod";

// C-PR1: `bio` sale del perfil (columna muerta hasta su DROP en Gate B8) y
// entra `jobTitle` («Cargo o puesto»).
export const UpdateProfileSchema = z.object({
  displayName: z.string().min(1, "El nombre es requerido").max(100, "Máximo 100 caracteres"),
  phone: z.string().max(20, "Máximo 20 caracteres").optional(),
  jobTitle: z.string().max(100, "Máximo 100 caracteres").optional(),
});
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
export const AVATAR_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AvatarMimeType = (typeof AVATAR_ALLOWED_TYPES)[number];

export type ActionResult =
  | { ok: true; url?: string }
  | { ok: false; error: string };
