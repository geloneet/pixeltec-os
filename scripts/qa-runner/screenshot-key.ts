/**
 * Key de R2 para una captura del qa-runner (PF-F8 T6, D3 del plan) — mismo
 * patrón que `pixelforge/visual/storage.ts` (`referenceImageKey`): key
 * determinística por proyecto+corrida+nombre, prefijo `pixelforge/<ownerId>/
 * <projectId>/qa/<qaRunId>/<nombre>.png`. Módulo puro, sin R2 — `index.ts`
 * hace `uploadObject(buildQaScreenshotKey(...), buffer, "image/png")`.
 */

/** Caracteres seguros de nombre de archivo — cualquier otra cosa se reemplaza por "-". */
const UNSAFE_NAME_CHARS = /[^a-zA-Z0-9_-]/g;

/** Sanea `name` a un segmento de ruta seguro (sin espacios, sin `/`, sin `..`). */
function sanitizeName(name: string): string {
  return name.replace(UNSAFE_NAME_CHARS, "-");
}

export function buildQaScreenshotKey(
  ownerId: string,
  projectId: string,
  qaRunId: string,
  name: string
): string {
  return `pixelforge/${ownerId}/${projectId}/qa/${qaRunId}/${sanitizeName(name)}.png`;
}
