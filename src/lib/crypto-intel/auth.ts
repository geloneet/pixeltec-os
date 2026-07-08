import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";

/**
 * Fase 2 de la migración: la sesión ya no es una cookie de Firebase — usa
 * `auth()` de NextAuth. Devuelve el Firebase UID puente
 * (`session.user.firebaseUid`), no el id de Postgres.
 *
 * Los datos de crypto-intel ya viven en Postgres (`crypto_alert_rules` etc.,
 * ver src/lib/db/schema.ts), pero `userId` ahí se preserva tal cual como
 * string crudo — a veces Firebase UID (alertas creadas desde el dashboard), a
 * veces ID de Telegram (alertas creadas desde el bot). Esta función debe
 * seguir devolviendo el mismo Firebase UID de siempre para que el chequeo de
 * ownership (`assertAlertOwnership`) siga comparando contra el valor correcto
 * — normalizar ambos espacios de identidad quedó fuera de alcance, ver
 * docs/superpowers/plans/2026-07-07-firebase-to-postgres-drizzle-nextauth-migration.md.
 */
export async function getSessionUid(): Promise<string | null> {
  const session = await auth();
  return session?.user?.firebaseUid ?? null;
}

export async function requireAdmin(): Promise<{ uid: string }> {
  const uid = await getSessionUid();
  if (!uid) redirect("/login?redirect=/crypto-intel/admin");

  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/crypto-intel");

  return { uid };
}
