/**
 * Punto de entrada público del motor IA de PixelForge.
 *
 * Ya NO expone `getPixelforgeAnthropic()`. Instanciar el SDK es exclusivo de
 * `@/lib/ai/anthropic-egress`, que aplica la política de egress de IA antes de
 * construir cliente o payload alguno; una fábrica que devolviera el cliente
 * crudo seguiría siendo un camino para hacer inferencia sin guarda, que es
 * justamente lo que este lote cierra.
 *
 * Queda la resolución de modelo (`resolvePixelForgeModel`/
 * `DEFAULT_PIXELFORGE_MODEL`), que vive en `./model` y se re-exporta aquí para
 * conservar la superficie pública descrita en el brief F2-T3.
 */

export { DEFAULT_PIXELFORGE_MODEL, resolvePixelForgeModel } from "./model";
