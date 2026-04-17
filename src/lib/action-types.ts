/**
 * Tipos compartidos de Server Actions.
 *
 * Vive aquí (no en src/app/actions.ts) porque archivos "use server"
 * solo pueden exportar funciones async en Next.js App Router.
 */

export type { PipelineContext } from '@/ai/types/agent-types';

export type PortalActionResult<T = undefined> = {
  success: boolean;
  data?: T;
  error?: string;
};
