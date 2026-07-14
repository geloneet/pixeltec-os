import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { AvatarUploader } from "@/components/profile/avatar-uploader";
import { ProfileForm } from "@/components/profile/profile-form";
import { SecuritySettings } from "@/components/perfil/security-settings";
import { getNavLabel } from "@/components/nav/command-palette-items";

export const metadata: Metadata = {
  title: "Perfil · PixelTEC OS",
  description: "Configuración de tu perfil y preferencias",
};

export default async function PerfilPage() {
  // Fase 4: perfil desde la tabla `users` de Postgres (antes Firebase Auth +
  // doc Firestore `users/{uid}`).
  const session = await auth();
  if (!session?.user?.id) redirect("/login?redirect=/perfil");

  const [row] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!row) redirect("/login?redirect=/perfil");

  const initialValues = {
    displayName: row.name,
    email: row.email,
    phone: row.phone ?? "",
    bio: row.bio ?? "",
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-16">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{getNavLabel("/perfil")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gestiona tu foto, información personal y seguridad.
        </p>
      </div>

      {/* Foto de perfil */}
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-base font-semibold text-foreground">Foto de perfil</h2>
        <AvatarUploader initialPhotoUrl={row.image} />
      </section>

      {/* Información personal */}
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-base font-semibold text-foreground">Información personal</h2>
        <ProfileForm initialValues={initialValues} />
      </section>

      {/* Seguridad */}
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-base font-semibold text-foreground">Seguridad</h2>
        <SecuritySettings />
      </section>
    </div>
  );
}
