import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { assertR2EgressAllowed } from "@/lib/egress-guard";
import { getR2BucketName, getR2PublicUrl, r2 } from "./client";

export async function uploadObject(
  key: string,
  body: Buffer,
  contentType: string,
  cacheControl = "public, max-age=3600"
): Promise<string> {
  // Construir el cliente no es egress; escribir sí. Por eso la guarda va aquí
  // y no en `client.ts`.
  assertR2EgressAllowed(getR2BucketName(), "upload");

  await r2.send(
    new PutObjectCommand({
      Bucket: getR2BucketName(),
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: cacheControl,
    })
  );
  return getR2PublicUrl(key);
}

/** No lanza si el objeto no existe — mismo comportamiento que bucket.file().delete() con Promise.allSettled del código Firebase que reemplaza. */
export async function deleteObject(key: string): Promise<void> {
  // Fuera del try: un bloqueo de política debe propagarse, no confundirse con
  // el "objeto inexistente" que este catch silencia deliberadamente.
  assertR2EgressAllowed(getR2BucketName(), "delete");

  try {
    await r2.send(new DeleteObjectCommand({ Bucket: getR2BucketName(), Key: key }));
  } catch {
    // best-effort, igual que el .catch silencioso vía Promise.allSettled anterior
  }
}
