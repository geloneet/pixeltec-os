import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
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

/**
 * URL firmada de vigencia corta — para documentos sensibles (contratos,
 * facturas) que se comparten por WhatsApp/link temporal, a diferencia de
 * getR2PublicUrl (permanente, usado para avatares/logos no sensibles).
 */
export async function getR2SignedUrl(key: string, expiresInSeconds = 172800): Promise<string> {
  const command = new GetObjectCommand({ Bucket: getR2BucketName(), Key: key });
  return getSignedUrl(r2, command, { expiresIn: expiresInSeconds });
}

/** No lanza si el objeto no existe — mismo comportamiento que bucket.file().delete() con Promise.allSettled del código Firebase que reemplaza. */
export async function deleteObject(key: string): Promise<void> {
  try {
    await r2.send(new DeleteObjectCommand({ Bucket: getR2BucketName(), Key: key }));
  } catch {
    // best-effort, igual que el .catch silencioso vía Promise.allSettled anterior
  }
}
