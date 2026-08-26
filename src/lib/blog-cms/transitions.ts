import type { BlogCmsIntent } from './schemas';

/**
 * Transición de estado por intención de guardado (paridad Encino
 * `saveBlogPostAction`, líneas 173-200). PURA para testearse sin DB:
 * - autosave: no cambia estado ni fechas.
 * - draft: `draft`; cancela cualquier programación; conserva `publishedAt`.
 * - publish: `published`; `publishedAt = existing ?? now` (la fecha original se
 *   conserva al re-publicar); cancela la programación.
 * - schedule: exige fecha futura parseable; `scheduled` + `scheduledAt`.
 */
export interface TransitionState {
  status: string;
  publishedAt: Date | null;
  scheduledAt: Date | null;
}

export type TransitionResult =
  | { ok: true; next: TransitionState }
  | { ok: false; error: string };

export const SCHEDULE_ERROR = 'Elige una fecha y hora futuras para programar la entrada.';

export function resolveSaveTransition(
  existing: TransitionState,
  intent: BlogCmsIntent,
  scheduledAtInput: string | undefined,
  now: Date,
): TransitionResult {
  switch (intent) {
    case 'autosave':
      return { ok: true, next: { ...existing } };
    case 'draft':
      return { ok: true, next: { status: 'draft', publishedAt: existing.publishedAt, scheduledAt: null } };
    case 'publish':
      return {
        ok: true,
        next: { status: 'published', publishedAt: existing.publishedAt ?? now, scheduledAt: null },
      };
    case 'schedule': {
      const when = scheduledAtInput ? new Date(scheduledAtInput) : null;
      if (!when || Number.isNaN(when.getTime()) || when.getTime() <= now.getTime()) {
        return { ok: false, error: SCHEDULE_ERROR };
      }
      return { ok: true, next: { status: 'scheduled', publishedAt: existing.publishedAt, scheduledAt: when } };
    }
  }
}

/** Slugs de sistema (`borrador-xxxxxxxx`, `entrada-xxxxxxxx`) se tratan como
 *  vacíos: escribir un título regenera el slug hasta que el usuario lo toque. */
export const SYSTEM_SLUG_RE = /^(borrador|entrada)-[0-9a-f]{8}$/;

export function isSystemSlug(slug: string): boolean {
  return SYSTEM_SLUG_RE.test(slug);
}
