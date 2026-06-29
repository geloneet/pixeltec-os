import { z } from 'zod';
import { parse, isValid } from 'date-fns';
import { parseDateTimeToUTC } from './timezone';

export interface ActionResult<T = void> {
  ok: boolean;
  data?: T;
  error?: string;
}

/**
 * Validador Zod para fecha en formato YYYY-MM-DD.
 * Valida formato regex + que sea una fecha calendario real
 * (rechaza 2026-13-99, 2026-02-31, etc.).
 */
export const AssistantDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD')
  .refine(
    (v) => isValid(parse(v, 'yyyy-MM-dd', new Date())),
    'Fecha inválida (día/mes fuera de rango)',
  );

/**
 * Validador Zod para hora en formato HH:mm (24h).
 * HH ∈ [00..23], mm ∈ [00..59].
 */
export const AssistantTimeString = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato HH:mm (00:00 a 23:59)');

export const AssistantTaskCreateSchema = z.object({
  title:       z.string().min(3, 'Mínimo 3 caracteres').max(120, 'Máximo 120 caracteres'),
  description: z.string().max(500).nullable().optional(),
  category:    z.enum(['trabajo', 'cliente', 'personal', 'salud', 'aprendizaje']),
  date:        AssistantDateString,
  time:        AssistantTimeString,
  durationMin: z.number().int().min(15).max(480).default(60),
  important:   z.boolean().optional().default(false),
});
export type AssistantTaskCreateInput = z.infer<typeof AssistantTaskCreateSchema>;

export const AssistantTaskUpdateSchema = AssistantTaskCreateSchema.partial();
export type AssistantTaskUpdateInput = z.infer<typeof AssistantTaskUpdateSchema>;

export const AssistantTaskStatusSchema = z.enum([
  'pending', 'in_progress', 'completed', 'cancelled', 'postponed',
]);
export type AssistantTaskStatusInput = z.infer<typeof AssistantTaskStatusSchema>;

export const AssistantPostponeSchema = z
  .object({
    date: AssistantDateString,
    time: AssistantTimeString,
  })
  .refine(
    ({ date, time }) => {
      try {
        const target = parseDateTimeToUTC(date, time);
        // Margen 60s: absorbe latencia humana entre seleccionar hora y
        // confirmar el postpone.
        return target.getTime() >= Date.now() - 60_000;
      } catch {
        // parseDateTimeToUTC lanza con formato inválido; los validadores
        // upstream (AssistantDateString/TimeString) ya lo cazan, así que
        // no es nuestro problema reportarlo aquí.
        return true;
      }
    },
    {
      message: 'La fecha debe ser posterior al momento actual',
      path: ['date'],
    },
  );
export type AssistantPostponeInput = z.infer<typeof AssistantPostponeSchema>;

export const WEEKDAY_CODES = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;
export type WeekdayCode = typeof WEEKDAY_CODES[number];

export const AssistantTemplateCreateSchema = z.object({
  title:       z.string().min(3, 'Mínimo 3 caracteres').max(120, 'Máximo 120 caracteres'),
  description: z.string().max(500, 'Máximo 500 caracteres').nullable().optional(),
  category:    z.enum(['trabajo', 'cliente', 'personal', 'salud', 'aprendizaje']),
  weekdays:    z.array(z.enum(['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'])).min(1, 'Selecciona al menos un día'),
  defaultTime: AssistantTimeString,
  durationMin: z.number().int().min(15).max(480).default(60),
});
export type AssistantTemplateCreateInput = z.infer<typeof AssistantTemplateCreateSchema>;

export const AssistantTemplateUpdateSchema = AssistantTemplateCreateSchema.partial();
export type AssistantTemplateUpdateInput = z.infer<typeof AssistantTemplateUpdateSchema>;
