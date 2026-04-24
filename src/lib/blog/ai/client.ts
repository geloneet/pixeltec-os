import Anthropic from '@anthropic-ai/sdk';

export function getAnthropic(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is required but not set');
  return new Anthropic({ apiKey });
}

export function getModel(): string {
  return process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-7';
}
