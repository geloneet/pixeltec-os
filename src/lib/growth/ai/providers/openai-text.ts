import OpenAI from 'openai';
import type { OpenAIRawResult } from '@/types/growth/ai';

let _client: OpenAI | null = null;
function client() {
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _client;
}

export interface TextGenerationInput {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
}

export async function generateText(input: TextGenerationInput): Promise<OpenAIRawResult> {
  const model = input.model ?? 'gpt-4o';
  const start = Date.now();

  const response = await client().chat.completions.create({
    model,
    temperature: 0.8,
    messages: [
      { role: 'system', content: input.systemPrompt },
      { role: 'user', content: input.userPrompt },
    ],
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
