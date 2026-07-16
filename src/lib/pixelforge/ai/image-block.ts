/**
 * Arma el content block `image` que el motor (`run.ts`) incrusta en un
 * `Anthropic.MessageParam` para `analyze_reference` (referencias `kind:
 * "image"`). Función PURA (sin red, sin DB) — extraída de
 * `prompts/analyze-reference.v1.ts` para poder testearla sola.
 *
 * VERIFICADO: el SDK 0.91 exporta `URLImageSource` (`{ type: "url", url }`,
 * ver `node_modules/@anthropic-ai/sdk/resources/messages/messages.d.ts`) —
 * usamos la URL pública de R2 directamente, SIN descargar ni convertir a
 * base64. `assetUrl` viene de `pixelforge_assets.url` (columna `text`
 * `.notNull()`), poblada al subir la imagen — ver `visual/storage.ts`.
 */
import type { Anthropic } from "@anthropic-ai/sdk";

export function buildImageBlock(assetUrl: string): Anthropic.ImageBlockParam {
  return {
    type: "image",
    source: { type: "url", url: assetUrl },
  };
}
