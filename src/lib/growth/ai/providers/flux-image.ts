import { createFalClient } from '@fal-ai/client';
import type { FalImageResult } from '@/types/growth/ai';

function getClient() {
  return createFalClient({ credentials: process.env.FAL_KEY });
}

export type FluxModel = 'fal-ai/flux/schnell' | 'fal-ai/flux/dev' | 'fal-ai/flux-pro/v1.1';

export interface FluxImageInput {
  prompt: string;
  width?: number;
  height?: number;
  model?: FluxModel;
}

export async function generateFluxImage(input: FluxImageInput): Promise<FalImageResult> {
  const model = input.model ?? 'fal-ai/flux/schnell';
  const start = Date.now();

  const result = await getClient().subscribe(model, {
    input: {
      prompt: input.prompt,
      image_size: { width: input.width ?? 1080, height: input.height ?? 1080 },
      num_inference_steps: 4,
      num_images: 1,
    },
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
