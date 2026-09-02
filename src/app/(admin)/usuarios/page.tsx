import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { resolveAuthority } from "@/lib/auth/authority";
import { listUsersAction } from "@/lib/users-admin/actions";
import { UsersDashboard } from "@/components/usuarios/users-dashboard";

export const metadata: Metadata = {
  title: "Usuarios y acceso · Pixeltec.mx",
  description: "Equipo interno: invitaciones, roles, suspensión y seguridad por cuenta",
};

/**
 * Sistema → Usuarios y acceso (C-PR5). Solo admins: además del guard por
 * action (requireAdmin en cada server action), la página rebota a /hoy si el
 * rol no es admin — un staff no debe ver ni el esqueleto.
 *
 * El rol se resuelve contra Postgres, NO contra `session.user.role`: el JWT
 * sella el rol al autenticar y seguiría diciendo "admin" después de una
 * degradación (ADR-0036).
 */
export default async function UsuariosPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?redirect=/usuarios");

  const authority = await resolveAuthority(session.user.id, session.user.credentialIssuedAt);
  if (!authority.ok) redirect("/login?redirect=/usuarios");
  if (!authority.isAdmin) redirect("/hoy");

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
