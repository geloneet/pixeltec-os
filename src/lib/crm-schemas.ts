import { z } from "zod";

export const clientSchema = z.object({
  name: z.string().min(1, "Nombre requerido").max(200),
  email: z.string().email("Email inválido").or(z.literal("")).optional().default(""),
  phone: z.string().max(20).optional().default(""),
  location: z.string().max(200).optional().default(""),
  notes: z.string().max(5000).optional().default(""),
});

export const projectSchema = z.object({
  name: z.string().min(1, "Nombre requerido").max(200),
  domain: z.string().max(200).optional().default(""),
  budget: z.string().max(100).optional().default(""),
  annual: z.string().max(100).optional().default(""),
  tech: z.string().max(500).optional().default(""),
});

export const taskSchema = z.object({
  name: z.string().min(1, "Nombre requerido").max(500),
  desc: z.string().max(5000).optional().default(""),
  prio: z.enum(["urgent_important", "important", "urgent", "low"]),
});
