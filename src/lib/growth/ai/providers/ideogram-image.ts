import type { IdeogramImageResult } from '@/types/growth/ai';

export interface IdeogramImageInput {
  prompt: string;
  aspectRatio?: 'ASPECT_1_1' | 'ASPECT_16_9' | 'ASPECT_9_16' | 'ASPECT_4_3';
}

export async function generateIdeogramImage(input: IdeogramImageInput): Promise<IdeogramImageResult> {
  const start = Date.now();
  const apiKey = process.env.IDEOGRAM_API_KEY;
  if (!apiKey) throw new Error('IDEOGRAM_API_KEY not configured');

  const body = {
    image_request: {
      prompt: input.prompt,
      aspect_ratio: input.aspectRatio ?? 'ASPECT_1_1',
      model: 'V_2',
      magic_prompt_option: 'AUTO',
    },
  };

  const res = await fetch('https://api.ideogram.ai/generate', {
    method: 'POST',
    headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ideogram error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as { data?: Array<{ url: string }> };
  const imageUrl = data.data?.[0]?.url ?? '';

  return {
    imageUrl,
    provider: 'ideogram',
    cost: 0.08,
    generationMs: Date.now() - start,
    model: 'ideogram_v2',
  };
}
