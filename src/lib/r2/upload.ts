import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { assertR2EgressAllowed } from "@/lib/egress-guard";
import { getR2BucketName, getR2PublicUrl } from "./client";

/**
 * Cliente S3 **privado de este módulo**.
 *
 * No se exporta a propósito: las dos funciones de abajo son la única forma de
 * llegar al bucket, y ambas empiezan por la guarda. Cuando el cliente vivía
 * exportado en `./client.ts`, bastaba un import para saltársela.
 *
 * Perezoso porque construirlo lee credenciales de entorno, y eso no debe
 * ocurrir al cargar el módulo en procesos que nunca tocan R2.
 */
let cliente: S3Client | null = null;

function r2(): S3Client {
  if (cliente === null) {
    cliente = new S3Client({
      region: "auto",
      endpoint: process.env.R2_ENDPOINT ?? "",
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
      },
    });
  }
  return cliente;
}

export async function uploadObject(
  key: string,
  body: Buffer,
  contentType: string,
  cacheControl = "public, max-age=3600"
): Promise<string> {
  // Construir el cliente no es egress; escribir sí. Por eso la guarda va aquí
  // y no en `client.ts`.
  assertR2EgressAllowed(getR2BucketName(), "upload");

  await r2().send(
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
    await r2().send(new DeleteObjectCommand({ Bucket: getR2BucketName(), Key: key }));
  } catch {
    // best-effort, igual que el .catch silencioso vía Promise.allSettled anterior
  }
}
