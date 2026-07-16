/**
 * Resolución de modelo para las operaciones IA de PixelForge — SIN
 * `"server-only"`: a diferencia de `client.ts` (que instancia el SDK con la
 * API key), esto es lógica pura (lee una var de entorno, sin secretos) y
 * `ai/run.ts` la necesita importable en tests de Vitest. Si viviera dentro
 * de `client.ts`, el `import "server-only"` de ese módulo (paquete NO
 * instalado en este repo — Next.js lo resuelve en build vía su propio
 * compilado, pero Node/Vitest no) rompería la resolución de módulos de
 * cualquier test que, transitivamente, importe `resolvePixelForgeModel`.
 * `client.ts` re-exporta ambos símbolos para conservar la superficie pública
 * descrita en el brief.
 */
import type { PixelforgeAIOperation } from "../schemas";

export const DEFAULT_PIXELFORGE_MODEL = "claude-sonnet-5";

/**
 * `operation` no cambia el resultado hoy — es el punto de extensión para el
 * experimento Sonnet/Opus por operación del plan maestro (algunas
 * operaciones podrían justificar un modelo más caro). Se mantiene en la
 * firma para no romper llamadas cuando ese experimento se active.
 */
export function resolvePixelForgeModel(operation: PixelforgeAIOperation): string {
  void operation;
  return process.env.PIXELFORGE_AI_MODEL ?? DEFAULT_PIXELFORGE_MODEL;
}
