/**
 * Modelo Anthropic para el pipeline de Definición de Proyecto.
 *
 * A diferencia del resto de rutas IA de la app (que caen a
 * `ANTHROPIC_MODEL ?? haiku`, pensado para tareas cortas), el "PM retador"
 * necesita razonamiento de producto — por eso usa su propia var
 * `DEFINITION_AI_MODEL` con fallback a Sonnet 5, SIN heredar `ANTHROPIC_MODEL`.
 *
 * Nota Sonnet 5: NO enviar `temperature`/`top_p`/`top_k` (el modelo los
 * rechaza). Las llamadas son single-shot `messages.create`, sin streaming —
 * consistente con toda la app.
 *
 * Aquí ya NO vive `getDefinitionClient()`: instanciar el SDK es exclusivo de
 * `@/lib/ai/anthropic-egress`, que aplica la política de egress antes de
 * construir nada. Este módulo se queda con la resolución de modelo y el tope de
 * tokens — lógica pura, sin secretos.
 */

export function getDefinitionModel(): string {
  return process.env.DEFINITION_AI_MODEL ?? "claude-sonnet-5";
}

/** Tokens máximos por generación. Los documentos (lista de funciones, MVP) pueden ser largos. */
export const DEFINITION_MAX_TOKENS = 8000;
