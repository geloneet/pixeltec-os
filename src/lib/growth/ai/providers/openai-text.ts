/**
 * Generación de texto de Growth. La llamada real vive en
 * `@/lib/ai/openai-egress`, que aplica la política de egress de IA antes de
 * construir el request y antes de construir el cliente.
 *
 * Este módulo ya no instancia OpenAI ni conserva un cliente entre llamadas: el
 * par `openai:<modelo>` debe estar autorizado en cada invocación.
 */
import { openaiChatCreate } from '@/lib/ai/openai-egress';
import type { OpenAIRawResult } from '@/types/growth/ai';

/** Modelo por defecto. Es el valor que se autoriza y el que viaja al SDK. */
const DEFAULT_MODEL = 'gpt-4o';

export interface TextGenerationInput {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
}

export async function generateText(input: TextGenerationInput): Promise<OpenAIRawResult> {
  const model = input.model ?? DEFAULT_MODEL;
  const start = Date.now();

  const response = await openaiChatCreate({
    operation: 'generate_text',
    model,
    // Diferido: si la guarda bloquea, `messages` no llega a construirse.
    buildParams: () => ({
      temperature: 0.8,
      messages: [
        { role: 'system', content: input.systemPrompt },
        { role: 'user', content: input.userPrompt },
      ],
    }),
  });

  const text = response.choices[0]?.message?.content ?? '';
  const usage = response.usage;
  const inputTokens = usage?.prompt_tokens ?? 0;
  const outputTokens = usage?.completion_tokens ?? 0;

  // GPT-4o pricing: $2.50/1M input, $10/1M output
  const cost = (inputTokens * 2.5 + outputTokens * 10) / 1_000_000;

  return {
    text,
    tokensUsed: { input: inputTokens, output: outputTokens },
    cost,
    generationMs: Date.now() - start,
    model,
  };
}
