/**
 * Resolución de modelo del pipeline de blog.
 *
 * Ya NO expone `getAnthropic()`: instanciar el SDK es exclusivo de
 * `@/lib/ai/anthropic-egress`, que aplica la política de egress antes de
 * construir cliente alguno. Lo que queda aquí es lógica pura, sin secretos.
 */

export function getModel(): string {
  return process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-7';
}
