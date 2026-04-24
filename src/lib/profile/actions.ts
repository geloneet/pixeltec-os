"use server";

import { revalidatePath } from "next/cache";
import { getFirestore } from "firebase-admin/firestore";
import { getAdminApp, getAdminAuth, getAdminStorage } from "@/lib/firebase-admin";
import { getSessionUid } from "@/lib/crypto-intel/auth";
import {
  AVATAR_MAX_BYTES,
  AVATAR_ALLOWED_TYPES,
  UpdateProfileSchema,
  type UpdateProfileInput,
  type ActionResult,
} from "./schemas";

const AVATAR_EXTS = ["jpg", "png", "webp"] as const;

function getAvatarBucket() {
  const name = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!name) throw new Error("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET env var is required");
  return getAdminStorage().bucket(name);
}

async function deleteExistingAvatars(uid: string): Promise<void> {
  const bucket = getAvatarBucket();
  await Promise.allSettled(
    AVATAR_EXTS.map((ext) => bucket.file(`users/${uid}/avatar.${ext}`).delete())
  );
}

export async function uploadAvatar(formData: FormData): Promise<ActionResult> {
  const uid = await getSessionUid();
  if (!uid) {
    console.error("[profile/actions] uploadAvatar: getSessionUid() returned null — session cookie missing or invalid");
    return { ok: false, error: "No autenticado" };
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    console.error("[profile/actions] uploadAvatar: no file in FormData");
    return { ok: false, error: "Sin archivo" };
  }
  console.log("[profile/actions] uploadAvatar: uid=%s file=%s size=%d type=%s", uid, file.name, file.size, file.type);

  if (file.size > AVATAR_MAX_BYTES) {
    return { ok: false, error: "El archivo supera 2 MB" };
  }
  if (!(AVATAR_ALLOWED_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, error: "Tipo no permitido. Usa JPG, PNG o WebP." };
  }

  try {
    const ext = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
    const path = `users/${uid}/avatar.${ext}`;

    await deleteExistingAvatars(uid);

    const buffer = Buffer.from(await file.arrayBuffer());
    const bucket = getAvatarBucket();
    const bucketName = bucket.name;

    await bucket.file(path).save(buffer, {
      contentType: file.type,
      metadata: { cacheControl: "public, max-age=3600" },
    });
    await bucket.file(path).makePublic();

    const publicUrl = `https://storage.googleapis.com/${bucketName}/${path}?v=${Date.now()}`;
    await getAdminAuth().updateUser(uid, { photoURL: publicUrl });

    revalidatePath("/", "layout");
    return { ok: true, url: publicUrl };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[profile/actions] uploadAvatar CATCH: uid=%s error=%s", uid, msg, err);
    return { ok: false, error: "Error al subir la imagen" };
  }
}

export async function deleteAvatar(): Promise<ActionResult> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: "No autenticado" };

  try {
    const user = await getAdminAuth().getUser(uid);
    if (!user.photoURL) return { ok: true };

    await deleteExistingAvatars(uid);
    await getAdminAuth().updateUser(uid, { photoURL: null });

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    console.error("[profile/actions]", { action: "deleteAvatar", uid, error: err });
    return { ok: false, error: "Error al eliminar la foto" };
  }
}

export async function updateProfile(input: UpdateProfileInput): Promise<ActionResult> {
  const uid = await getSessionUid();
  if (!uid) return { ok: false, error: "No autenticado" };

  const parsed = UpdateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0].message };
  }

  const { displayName, phone, bio } = parsed.data;

  try {
    await getAdminAuth().updateUser(uid, { displayName });

    const db = getFirestore(getAdminApp());
    await db.collection("users").doc(uid).set(
      { phone: phone || null, bio: bio || null },
      { merge: true }
    );

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    console.error("[profile/actions]", { action: "updateProfile", uid, error: err });
    return { ok: false, error: "Error al guardar los cambios" };
  }
}
