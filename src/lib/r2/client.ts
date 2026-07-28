/**
 * Configuración de R2 — sin cliente.
 *
 * Este módulo exportaba `const r2 = new S3Client(...)`. Cualquiera que lo
 * importara obtenía un cliente capaz de escribir y borrar en el bucket sin
 * pasar por `assertR2EgressAllowed`. El cliente vive ahora privado dentro de
 * `./upload.ts`, junto a las dos únicas operaciones que la política autoriza.
 */

export function getR2BucketName(): string {
  const name = process.env.R2_BUCKET_NAME;
  if (!name) throw new Error("R2_BUCKET_NAME env var is required");
  return name;
}

export function getR2PublicUrl(key: string): string {
  const base = process.env.R2_PUBLIC_URL;
  if (!base) throw new Error("R2_PUBLIC_URL env var is required");
  return `${base.replace(/\/$/, "")}/${key}`;
}
