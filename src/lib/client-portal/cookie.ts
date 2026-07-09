import { cookies } from "next/headers";
import { signPortalSessionToken, verifyPortalSessionToken } from "./session-token";

const COOKIE_NAME = "__client_portal_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

function getSecret(): string {
  const secret = process.env.PORTAL_SESSION_SECRET;
  if (!secret) throw new Error("PORTAL_SESSION_SECRET no está configurado.");
  return secret;
}

/** `publicClientId` = `clients.firestoreId ?? clients.id` — mismo formato que usa el resto de la app (ver `publicDocId` en `src/lib/documents/pg.ts`). */
export async function createPortalSessionCookie(publicClientId: string): Promise<void> {
  const token = signPortalSessionToken({ clientId: publicClientId, exp: Date.now() + SESSION_TTL_MS }, getSecret());
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

/** Devuelve el `publicClientId` de la sesión vigente, o `null` si no hay cookie / es inválida / expiró. */
export async function readPortalSessionClientId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const result = verifyPortalSessionToken(token, getSecret(), Date.now());
  return result?.clientId ?? null;
}

export async function clearPortalSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
