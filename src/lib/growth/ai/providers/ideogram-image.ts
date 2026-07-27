/**
 * Generación de imagen con Ideogram. La llamada real vive en
 * `@/lib/ai/image-egress`, que aplica la política de egress de IA antes de
 * construir el body y antes de leer la credencial.
 */
import { ideogramGenerateImage } from '@/lib/ai/image-egress';
import type { IdeogramImageResult } from '@/types/growth/ai';

/**
 * Modelo real que viaja en el body — es el valor que se autoriza, y la guarda
 * lo compara normalizado contra `ideogram:v_2`.
 */
const IDEOGRAM_MODEL = 'V_2';

/**
 * Etiqueta del contrato de respuesta. Es un nombre interno, no describe lo que
 * sale por el cable: no debe usarse para autorizar.
 */
const IDEOGRAM_RESULT_MODEL = 'ideogram_v2';

export interface IdeogramImageInput {
  prompt: string;
  aspectRatio?: 'ASPECT_1_1' | 'ASPECT_16_9' | 'ASPECT_9_16' | 'ASPECT_4_3';
}

export async function generateIdeogramImage(input: IdeogramImageInput): Promise<IdeogramImageResult> {
  const start = Date.now();

  const data = (await ideogramGenerateImage({
    model: IDEOGRAM_MODEL,
    // Diferido: si la guarda bloquea, el body no llega a construirse.
    buildBody: () => ({
      image_request: {
        prompt: input.prompt,
        aspect_ratio: input.aspectRatio ?? 'ASPECT_1_1',
        model: IDEOGRAM_MODEL,
        magic_prompt_option: 'AUTO',
      },
    }),
  })) as { data?: Array<{ url: string }> };

  const imageUrl = data.data?.[0]?.url ?? '';

  return {
    imageUrl,
    provider: 'ideogram',
    cost: 0.08,
    generationMs: Date.now() - start,
    model: IDEOGRAM_RESULT_MODEL,
  };
}
