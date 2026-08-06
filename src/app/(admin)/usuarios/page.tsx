import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { listUsersAction } from "@/lib/users-admin/actions";
import { UsersDashboard } from "@/components/usuarios/users-dashboard";

export const metadata: Metadata = {
  title: "Usuarios y acceso · PixelTEC OS",
  description: "Equipo interno: invitaciones, roles, suspensión y seguridad por cuenta",
};

/**
 * Sistema → Usuarios y acceso (C-PR5). Solo admins: además del guard por
 * action (requireAdmin en cada server action), la página rebota a /hoy si el
 * rol de la sesión no es admin — un staff no debe ver ni el esqueleto.
 */
export default async function UsuariosPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?redirect=/usuarios");
  if (session.user.role !== "admin") redirect("/hoy");

  const res = await listUsersAction();
  const users = res.ok ? res.users : [];

  return (
    <div className="mx-auto max-w-6xl">
      <UsersDashboard
        users={users}
        currentUserId={session.user.id}
        loadFailed={!res.ok}
      />
    </div>
  );
}
