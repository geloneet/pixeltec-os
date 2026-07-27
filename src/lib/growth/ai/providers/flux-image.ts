/**
 * Generación de imagen con fal.ai (Flux). La llamada real vive en
 * `@/lib/ai/image-egress`, que aplica la política de egress de IA antes de
 * construir el input del SDK y antes de construir el cliente.
 *
 * Este módulo ya no crea el cliente de fal: el par `fal:<modelo>` debe estar
 * autorizado en cada invocación.
 */
import { falSubscribe } from '@/lib/ai/image-egress';
import type { FalImageResult } from '@/types/growth/ai';

export type FluxModel = 'fal-ai/flux/schnell' | 'fal-ai/flux/dev' | 'fal-ai/flux-pro/v1.1';

/** Modelo por defecto. Es el valor que se autoriza y el que viaja al SDK. */
const DEFAULT_MODEL: FluxModel = 'fal-ai/flux/schnell';

export interface FluxImageInput {
  prompt: string;
  width?: number;
  height?: number;
  model?: FluxModel;
}

export async function generateFluxImage(input: FluxImageInput): Promise<FalImageResult> {
  const model = input.model ?? DEFAULT_MODEL;
  const start = Date.now();

  const result = await falSubscribe({
    model,
    // Diferido: si la guarda bloquea, el input del SDK no llega a construirse.
    buildInput: () => ({
      prompt: input.prompt,
      image_size: { width: input.width ?? 1080, height: input.height ?? 1080 },
      num_inference_steps: 4,
      num_images: 1,
    }),
  });

  const images = (result.data as { images?: Array<{ url: string }> })?.images ?? [];
  const imageUrl = images[0]?.url ?? '';

  return {
    imageUrl,
    provider: 'fal_flux',
    cost: 0.003,
    generationMs: Date.now() - start,
    model,
  };
}
