import { z } from 'zod';

export interface ActionResult<T = void> {
  ok: boolean;
  data?: T;
  error?: string;
}

export const AssistantTaskCreateSchema = z.object({
  title:       z.string().min(3, 'Mínimo 3 caracteres').max(120, 'Máximo 120 caracteres'),
  description: z.string().max(500).nullable().optional(),
  category:    z.enum(['trabajo', 'cliente', 'personal', 'salud', 'aprendizaje']),
  date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD'),
  time:        z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:mm'),
  durationMin: z.number().int().min(15).max(480).default(60),
});
export type AssistantTaskCreateInput = z.infer<typeof AssistantTaskCreateSchema>;

export const AssistantTaskUpdateSchema = AssistantTaskCreateSchema.partial();
export type AssistantTaskUpdateInput = z.infer<typeof AssistantTaskUpdateSchema>;

export const AssistantTaskStatusSchema = z.enum([
  'pending', 'in_progress', 'completed', 'cancelled', 'postponed',
]);
export type AssistantTaskStatusInput = z.infer<typeof AssistantTaskStatusSchema>;

export const AssistantPostponeSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:mm'),
});
export type AssistantPostponeInput = z.infer<typeof AssistantPostponeSchema>;

export const WEEKDAY_CODES = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;
export type WeekdayCode = typeof WEEKDAY_CODES[number];

export const AssistantTemplateCreateSchema = z.object({
  title:       z.string().min(3, 'Mínimo 3 caracteres').max(120, 'Máximo 120 caracteres'),
  description: z.string().max(500, 'Máximo 500 caracteres').nullable().optional(),
  category:    z.enum(['trabajo', 'cliente', 'personal', 'salud', 'aprendizaje']),
  weekdays:    z.array(z.enum(['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'])).min(1, 'Selecciona al menos un día'),
  defaultTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato HH:mm'),
  durationMin: z.number().int().min(15).max(480).default(60),
});
export type AssistantTemplateCreateInput = z.infer<typeof AssistantTemplateCreateSchema>;

export const AssistantTemplateUpdateSchema = AssistantTemplateCreateSchema.partial();
export type AssistantTemplateUpdateInput = z.infer<typeof AssistantTemplateUpdateSchema>;
