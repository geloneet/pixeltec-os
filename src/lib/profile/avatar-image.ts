import type { AvatarMimeType } from "./schemas";

/**
 * C-PR1: validación de contenido real del avatar. `uploadAvatar` ya validaba
 * tamaño y `file.type`, pero el type lo DECLARA el cliente — aquí se comprueba
 * que los primeros bytes del buffer correspondan de verdad al formato declarado
 * antes de tocar R2.
 *
 * Firmas:
 *  - JPEG: FF D8 FF
 *  - PNG:  89 50 4E 47
 *  - WebP: "RIFF" (52 49 46 46) en 0..3 + "WEBP" (57 45 42 50) en 8..11
 */
export function matchesMagicBytes(bytes: Uint8Array, declaredType: AvatarMimeType): boolean {
  switch (declaredType) {
    case "image/jpeg":
      return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case "image/png":
      return (
        bytes.length >= 4 &&
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47
      );
    case "image/webp":
      return (
        bytes.length >= 12 &&
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46 &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50
      );
  }
}
