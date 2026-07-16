/**
 * Storage R2 de imágenes de referencia visual (PixelForge F4).
 *
 * Mismo patrón que `src/lib/growth/storage/brands.ts` (logos) /
 * `src/lib/profile/actions.ts` (avatares): key determinística por
 * proyecto+referencia+extensión, y borrado best-effort de las 3 extensiones
 * posibles ANTES de subir la nueva — así una re-subida con un mimeType
 * distinto (ej. png → webp) no deja el objeto viejo huérfano en R2.
 */
import { deleteObject, uploadObject } from "@/lib/r2/upload";

/** Whitelist de mime types de imagen aceptados para referencias visuales. */
const MIME_EXT: Record<string, "png" | "jpg" | "webp"> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

const REFERENCE_IMAGE_EXTS = ["png", "jpg", "webp"] as const;

const MAX_BYTES = 5 * 1024 * 1024; // 5MB

function referenceImageKey(
  uid: string,
  projectId: string,
  referenceId: string,
  ext: string
): string {
  return `pixelforge/${uid}/${projectId}/references/${referenceId}.${ext}`;
}

async function deleteExistingReferenceImages(
  uid: string,
  projectId: string,
  referenceId: string
): Promise<void> {
  await Promise.allSettled(
    REFERENCE_IMAGE_EXTS.map((ext) =>
      deleteObject(referenceImageKey(uid, projectId, referenceId, ext))
    )
  );
}

/**
 * Sube la imagen de una referencia visual a R2. Valida mime (whitelist
 * png/jpeg/webp) y tamaño (cap 5MB, límite estricto `>`, no `>=`) ANTES de
 * tocar R2 — si falla la validación no borra ni sube nada. Borra las 3
 * extensiones posibles de versiones previas de ESA referencia antes de
 * subir la nueva. Devuelve la url pública y la key final.
 */
export async function uploadReferenceImage(
  uid: string,
  projectId: string,
  referenceId: string,
  file: Buffer,
  mimeType: string
): Promise<{ url: string; key: string }> {
  const ext = MIME_EXT[mimeType];
  if (!ext) {
    throw new Error("Formato de imagen no permitido");
  }
  if (file.length > MAX_BYTES) {
    throw new Error("La imagen excede 5MB");
  }

  const key = referenceImageKey(uid, projectId, referenceId, ext);

  await deleteExistingReferenceImages(uid, projectId, referenceId);

  const url = await uploadObject(key, file, mimeType);
  return { url, key };
}
