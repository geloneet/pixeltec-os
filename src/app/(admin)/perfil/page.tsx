import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { ShieldAlert } from "lucide-react";
import { userMfa } from "@/lib/db/schema";
import { AvatarUploader } from "@/components/profile/avatar-uploader";
import { ProfileForm } from "@/components/profile/profile-form";
import { SecuritySettings } from "@/components/perfil/security-settings";
import { MfaSettings } from "@/components/perfil/mfa-settings";
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

  // C-PR4: estado 2FA — fire-safe: si la tabla 0033 aún no existe (se aplica
  // en el deploy gobernado), se muestra como no configurada.
  let mfaEnabled = false;
  try {
    const [mfaRow] = await db
      .select({ enabledAt: userMfa.enabledAt })
      .from(userMfa)
      .where(eq(userMfa.userId, session.user.id))
      .limit(1);
    mfaEnabled = Boolean(mfaRow?.enabledAt);
  } catch (err) {
    console.error("[perfil] user_mfa read failed — showing as disabled:", err);
  }

  const initialValues = {
    displayName: row.name,
    email: row.email,
    phone: row.phone ?? "",
    jobTitle: row.jobTitle ?? "",
  };

  const fechaLarga = new Intl.DateTimeFormat("es-MX", { dateStyle: "long" });
  const fechaConHora = new Intl.DateTimeFormat("es-MX", {
    dateStyle: "long",
    timeStyle: "short",
  });

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

      {/* Acceso asignado (C-PR1) — solo lectura: rol y rastro de acceso.
          `last_login_at` lo escribirá el flujo de login en un PR posterior;
          mientras tanto se muestra «—». */}
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-base font-semibold text-foreground">Acceso asignado</h2>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Rol</dt>
            <dd className="mt-1 text-sm font-medium text-foreground">
              {row.role === "admin" ? "Administrador" : "Staff"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Estado</dt>
            <dd className="mt-1 text-sm font-medium text-foreground">Activa</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Cuenta creada</dt>
            <dd className="mt-1 text-sm font-medium text-foreground">
              {fechaLarga.format(row.createdAt)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Último acceso</dt>
            <dd className="mt-1 text-sm font-medium text-foreground">
              {row.lastLoginAt ? fechaConHora.format(row.lastLoginAt) : "—"}
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-muted-foreground">
          Tu rol y áreas los administra un administrador.
        </p>
      </section>

      {/* Seguridad */}
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-base font-semibold text-foreground">Seguridad</h2>
        {/* C-PR4: soft-enforce para admins — aviso, sin bloqueo. El
            hard-enforce futuro se activará con MFA_REQUIRED_FOR_ADMINS
            (documentada en .env.example), hoy solo recomendación. */}
        {row.role === "admin" && !mfaEnabled && (
          <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <p className="text-xs leading-relaxed text-amber-400">
              Tu cuenta es de administrador y no tiene verificación en dos
              pasos. Te recomendamos activarla: es la protección más efectiva
              contra el robo de contraseña.
            </p>
          </div>
        )}
        <div className="space-y-8">
          <MfaSettings initialEnabled={mfaEnabled} />
          <SecuritySettings />
        </div>
      </section>
    </div>
  );
}
