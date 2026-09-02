import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { checkInvitationTokenAction } from "@/lib/users-admin/invitation-actions";
import { InvitationForm } from "./invitation-form";

export const metadata: Metadata = {
  title: "Activa tu cuenta · Pixeltec.mx",
  description: "Acepta tu invitación al equipo interno de Pixeltec.mx",
};

/**
 * Ruta PÚBLICA (C-PR5): igual que /reset-password, NO está en ADMIN_ROUTES
 * (src/lib/routes/admin-routes.ts), así que el middleware no exige sesión —
 * la credencial es el token del enlace. La validación real (hash, TTL, no
 * usado, usuario 'invited') vive en el server: aquí solo se decide qué
 * renderizar y el submit revalida todo de nuevo.
 */
export default async function InvitacionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const check = await checkInvitationTokenAction(token);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6 py-16 text-white">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Image
            src={process.env.NEXT_PUBLIC_LOGO_URL!}
            alt="PixelTEC"
            width={48}
            height={48}
            className="h-12 w-12"
          />
        </div>
        {check.valid ? (
          <>
            <h1 className="mb-2 text-center font-logo text-3xl font-extrabold tracking-tight text-white">
              Hola, {check.name}
            </h1>
            <p className="mb-10 text-center text-sm text-zinc-400">
              Te invitaron a Pixeltec.mx. Elige tu contraseña para activar tu cuenta.
            </p>
            <InvitationForm token={token} />
          </>
        ) : (
          <div className="text-center">
            <h1 className="mb-2 font-logo text-3xl font-extrabold tracking-tight text-white">
              Invitación
            </h1>
            {/* Anti-enumeración: un solo mensaje para token inexistente,
                expirado, ya usado o cuenta que ya no está invitada. */}
            <p className="mb-6 text-sm text-zinc-400">
              Este enlace no es válido o expiró. Pide a un administrador que te
              reenvíe la invitación.
            </p>
            <Link href="/login" className="text-sm text-cyan-400 hover:underline">
              Ir al login
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
