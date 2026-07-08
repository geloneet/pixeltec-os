import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getR2BucketName, getR2PublicUrl, r2 } from "./client";

export async function uploadObject(
  key: string,
  body: Buffer,
  contentType: string,
  cacheControl = "public, max-age=3600"
): Promise<string> {
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
  try {
    await r2.send(new DeleteObjectCommand({ Bucket: getR2BucketName(), Key: key }));
  } catch {
    // best-effort, igual que el .catch silencioso vía Promise.allSettled anterior
  }
}
