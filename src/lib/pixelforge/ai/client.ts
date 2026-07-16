/**
 * Cliente Anthropic para el motor IA de PixelForge — calco de
 * `src/lib/blog/ai/client.ts`. Instancia el SDK con la API key: no debe
 * colarse en un bundle de cliente.
 *
 * Server-only por convención: importar únicamente desde API routes / server
 * actions (el paquete "server-only" no está instalado en este repo — un
 * `import "server-only"` real rompería la resolución de módulos de Vitest,
 * que no tiene el alias que Next.js le inyecta en build; ver `ai/model.ts`
 * para el detalle completo).
 *
 * La resolución de modelo (`resolvePixelForgeModel`/`DEFAULT_PIXELFORGE_MODEL`)
 * vive en `./model` y se re-exporta aquí para que este módulo siga siendo el
 * punto de entrada público descrito en el brief F2-T3.
 */
import Anthropic from "@anthropic-ai/sdk";

export function getPixelforgeAnthropic(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is required but not set");
  return new Anthropic({ apiKey });
}

export { DEFAULT_PIXELFORGE_MODEL, resolvePixelForgeModel } from "./model";
