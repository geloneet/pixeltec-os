"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getAdminStorage } from "@/lib/firebase-admin";
import {
  AVATAR_MAX_BYTES,
  AVATAR_ALLOWED_TYPES,
  UpdateProfileSchema,
  type UpdateProfileInput,
  type ActionResult,
} from "./schemas";

// Fase 4: el perfil vive en la tabla `users` de Postgres (antes:
// displayName/photoURL en Firebase Auth + phone/bio en Firestore). El
// ARCHIVO del avatar sigue en Firebase Storage a propósito (decisión del
// plan: Postgres no reemplaza blob storage) — aquí solo se persiste la URL.

const AVATAR_EXTS = ["jpg", "png", "webp"] as const;

async function requireSessionUser(): Promise<{ id: string; storageUid: string } | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  // El path de Storage sigue scoped por Firebase UID (archivos existentes).
  return { id: session.user.id, storageUid: session.user.firebaseUid ?? session.user.id };
}

function getAvatarBucket() {
  const name = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!name) throw new Error("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET env var is required");
  return getAdminStorage().bucket(name);
}

async function deleteExistingAvatars(storageUid: string): Promise<void> {
  const bucket = getAvatarBucket();
  await Promise.allSettled(
    AVATAR_EXTS.map((ext) => bucket.file(`users/${storageUid}/avatar.${ext}`).delete())
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

  try {
    const ext = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
    const path = `users/${user.storageUid}/avatar.${ext}`;

    await deleteExistingAvatars(user.storageUid);

    const buffer = Buffer.from(await file.arrayBuffer());
    const bucket = getAvatarBucket();

    await bucket.file(path).save(buffer, {
      contentType: file.type,
      metadata: { cacheControl: "public, max-age=3600" },
    });
    await bucket.file(path).makePublic();

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${path}?v=${Date.now()}`;
    await db
      .update(users)
      .set({ image: publicUrl, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    revalidatePath("/", "layout");
    return { ok: true, url: publicUrl };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[profile/actions] uploadAvatar: user=%s error=%s", user.id, msg, err);
    return { ok: false, error: "Error al subir la imagen" };
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
    console.error("[profile/actions]", { action: "deleteAvatar", user: user.id, error: err });
    return { ok: false, error: "Error al eliminar la foto" };
  }
}

export async function updateProfile(input: UpdateProfileInput): Promise<ActionResult> {
  const user = await requireSessionUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const parsed = UpdateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0].message };
  }

  const { displayName, phone, bio } = parsed.data;

  try {
    await db
      .update(users)
      .set({
        name: displayName,
        phone: phone || null,
        bio: bio || null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    console.error("[profile/actions]", { action: "updateProfile", user: user.id, error: err });
    return { ok: false, error: "Error al guardar los cambios" };
  }
}
