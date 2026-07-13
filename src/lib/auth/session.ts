import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";

/**
 * Guard de sesión/admin compartido por toda la app. La sesión ya no es una
 * cookie de Firebase — usa `auth()` de NextAuth. Devuelve el Firebase UID
 * puente (`session.user.firebaseUid`), no el id de Postgres.
 *
 * Se preserva el Firebase UID (en vez de migrar a un id de Postgres) porque
 * varios repos todavía guardan `userId` como string crudo bajo ese espacio de
 * identidad — normalizarlo quedó fuera de alcance, ver
 * docs/superpowers/plans/2026-07-07-firebase-to-postgres-drizzle-nextauth-migration.md.
 */
export async function getSessionUid(): Promise<string | null> {
  const session = await auth();
  return session?.user?.firebaseUid ?? null;
}

export async function requireAdmin(): Promise<{ uid: string }> {
  const uid = await getSessionUid();
  if (!uid) redirect("/login");

  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/hoy");

  return { uid };
}
