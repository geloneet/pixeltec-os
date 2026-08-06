"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { deleteObject, uploadObject } from "@/lib/r2/upload";
import { toPublicFailure } from "@/lib/errors/public-failure";
import sharp from "sharp";
import {
  AVATAR_MAX_BYTES,
  AVATAR_ALLOWED_TYPES,
  UpdateProfileSchema,
  type AvatarMimeType,
  type UpdateProfileInput,
  type ActionResult,
} from "./schemas";
import { matchesMagicBytes } from "./avatar-image";

// Fase 4: el perfil vive en la tabla `users` de Postgres (antes:
// displayName/photoURL en Firebase Auth + phone/bio en Firestore). Fase C
// (retiro Firebase): el ARCHIVO del avatar se movió de Firebase Storage a
// Cloudflare R2 — aquí solo se persiste la URL pública.

const AVATAR_EXTS = ["jpg", "png", "webp"] as const;

async function requireSessionUser(): Promise<{ id: string; storageUid: string } | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const id = session.user.id;
  // COMPAT (hasta el Gate B8): los avatares existentes viven bajo el alias
  // Firebase en R2. El alias ya no viaja en la sesión (B6), así que esta es la
  // ÚNICA lectura runtime permitida de `users.firebase_uid`; cae junto con la
  // columna al migrar los paths.
  const [row] = await db
    .select({ legacyUid: users.firebaseUid })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return { id, storageUid: row?.legacyUid ?? id };
}

async function deleteExistingAvatars(storageUid: string): Promise<void> {
  await Promise.allSettled(
    AVATAR_EXTS.map((ext) => deleteObject(`users/${storageUid}/avatar.${ext}`))
  );
}

export async function uploadAvatar(formData: FormData): Promise<ActionResult> {
  const user = await requireSessionUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const file = formData.get("file") as File | null;
  if (!file) return { ok: false, error: "Sin archivo" };

  if (file.size > AVATAR_MAX_BYTES) {
    return { ok: false, error: "El archivo supera 2 MB" };
  }
  if (!(AVATAR_ALLOWED_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, error: "Tipo no permitido. Usa JPG, PNG o WebP." };
  }

  // C-PR1: `file.type` lo declara el cliente — se verifica que el contenido
  // real del buffer coincida (magic bytes) antes de tocar R2.
  const rawBuffer = Buffer.from(await file.arrayBuffer());
  if (!matchesMagicBytes(rawBuffer, file.type as AvatarMimeType)) {
    return { ok: false, error: "El archivo no corresponde al formato declarado." };
  }

  try {
    const ext = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
    const path = `users/${user.storageUid}/avatar.${ext}`;

    // C-PR1: re-encode con sharp — descarta metadatos (EXIF/GPS) y limita a
    // 512×512 manteniendo proporción. Si el buffer no decodifica como imagen
    // real, sharp lanza y cae al catch (respuesta pública genérica).
    const buffer = await sharp(rawBuffer)
      .rotate() // aplica la orientación EXIF antes de descartar metadatos
      .resize(512, 512, { fit: "inside", withoutEnlargement: true })
      .toFormat(file.type === "image/jpeg" ? "jpeg" : file.type === "image/png" ? "png" : "webp")
      .toBuffer();

    await deleteExistingAvatars(user.storageUid);

    const uploadedUrl = await uploadObject(path, buffer, file.type);
    const publicUrl = `${uploadedUrl}?v=${Date.now()}`;
    await db
      .update(users)
      .set({ image: publicUrl, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    revalidatePath("/", "layout");
    return { ok: true, url: publicUrl };
  } catch (err) {
    // El log llevaba el `message` crudo y además el objeto `err` entero, que
    // arrastra stack y —en un fallo de R2— la clave del bucket y la URL
    // firmada. Sólo se registra un código estable y el usuario afectado.
    const failure = toPublicFailure(err, {
      code: "profile_upload_avatar_failed",
      message: "Error al subir la imagen",
    });
    console.error("[profile/actions] uploadAvatar: user=%s code=%s", user.id, failure.code);
    return { ok: false, error: failure.message };
  }
}

export async function deleteAvatar(): Promise<ActionResult> {
  const user = await requireSessionUser();
  if (!user) return { ok: false, error: "No autenticado" };

  try {
    await deleteExistingAvatars(user.storageUid);
    await db.update(users).set({ image: null, updatedAt: new Date() }).where(eq(users.id, user.id));

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    // Mismo criterio que uploadAvatar (E0f-3a): el objeto `err` arrastra stack
    // y detalle de R2/Drizzle — al log solo va el código estable.
    const failure = toPublicFailure(err, {
      code: "profile_delete_avatar_failed",
      message: "Error al eliminar la foto",
    });
    console.error("[profile/actions] deleteAvatar: user=%s code=%s", user.id, failure.code);
    return { ok: false, error: failure.message };
  }
}

export async function updateProfile(input: UpdateProfileInput): Promise<ActionResult> {
  const user = await requireSessionUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const parsed = UpdateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0].message };
  }

  const { displayName, phone, jobTitle } = parsed.data;

  try {
    // C-PR1: se persiste `jobTitle` y se deja de escribir `bio` — la columna
    // queda muerta; su DROP se difiere al Gate B8 (junto con firebase_uid).
    await db
      .update(users)
      .set({
        name: displayName,
        phone: phone || null,
        jobTitle: jobTitle || null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    const failure = toPublicFailure(err, {
      code: "profile_update_failed",
      message: "Error al guardar los cambios",
    });
    console.error("[profile/actions] updateProfile: user=%s code=%s", user.id, failure.code);
    return { ok: false, error: failure.message };
  }
}
