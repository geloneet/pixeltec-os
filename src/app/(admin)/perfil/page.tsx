import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getAdminApp, getAdminAuth } from "@/lib/firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { getSessionUid } from "@/lib/crypto-intel/auth";
import { AvatarUploader } from "@/components/profile/avatar-uploader";
import { ProfileForm } from "@/components/profile/profile-form";
import { SecuritySettings } from "@/components/perfil/security-settings";
import { getNavLabel } from "@/components/nav/command-palette-items";

export const metadata: Metadata = {
  title: "Perfil · PixelTEC OS",
  description: "Configuración de tu perfil y preferencias",
};

export default async function PerfilPage() {
  const uid = await getSessionUid();
  if (!uid) redirect("/login?redirect=/perfil");

  const auth = getAdminAuth();
  const authUser = await auth.getUser(uid);

  let phone = "";
  let bio = "";
  try {
    const db = getFirestore(getAdminApp());
    const doc = await db.collection("users").doc(uid).get();
    const data = doc.data();
    phone = (data?.phone as string) ?? "";
    bio = (data?.bio as string) ?? "";
  } catch (err) {
    console.error("[perfil/page] failed to read Firestore user doc", err);
  }

  const initialValues = {
    displayName: authUser.displayName ?? "",
    email: authUser.email ?? "",
    phone,
    bio,
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-16">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">{getNavLabel("/perfil")}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Gestiona tu foto, información personal y seguridad.
        </p>
      </div>

      {/* Foto de perfil */}
      <section className="rounded-xl border border-white/5 bg-white/[0.03] p-6">
        <h2 className="mb-4 text-base font-semibold text-zinc-100">Foto de perfil</h2>
        <AvatarUploader />
      </section>

      {/* Información personal */}
      <section className="rounded-xl border border-white/5 bg-white/[0.03] p-6">
        <h2 className="mb-4 text-base font-semibold text-zinc-100">Información personal</h2>
        <ProfileForm initialValues={initialValues} />
      </section>

      {/* Seguridad */}
      <section className="rounded-xl border border-white/5 bg-white/[0.03] p-6">
        <h2 className="mb-4 text-base font-semibold text-zinc-100">Seguridad</h2>
        <SecuritySettings />
      </section>
    </div>
  );
}
