'use server';

import bcrypt from 'bcryptjs';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { clients } from '@/lib/db/schema';
import { clearAuthFailures, isEmailLocked, recordAuthFailure } from '@/lib/auth-brute-force';
import {
  clearLegacyPortalSession,
  createLegacyPortalSession,
} from '@/lib/portal/legacy-session';

export interface LegacyLoginResult {
  ok: boolean;
  error?: string;
}

/**
 * Login del portal legado — reemplaza `signInWithEmailAndPassword` de
 * Firebase. Mismo lockout por email que el login de staff (NextAuth,
 * `src/lib/auth/config.ts`) vía `auth-brute-force.ts` — comparten el
 * contador porque ambos son, de cara al atacante, el mismo formulario de
 * login de la app.
 */
export async function loginLegacyPortal(email: string, password: string): Promise<LegacyLoginResult> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) {
    return { ok: false, error: 'Correo y contraseña son requeridos' };
  }

  const lockout = await isEmailLocked(normalizedEmail);
  if (lockout.locked) {
    return { ok: false, error: `Demasiados intentos. Intenta de nuevo ${lockout.retryAfter}.` };
  }

  const [client] = await db
    .select({ id: clients.id, passwordHash: clients.legacyPasswordHash })
    .from(clients)
    .where(and(eq(clients.source, 'portal'), sql`lower(${clients.email}) = ${normalizedEmail}`))
    .limit(1);

  if (!client?.passwordHash) {
    await recordAuthFailure(normalizedEmail);
    return { ok: false, error: 'El correo electrónico o la contraseña son incorrectos.' };
  }

  const valid = await bcrypt.compare(password, client.passwordHash);
  if (!valid) {
    await recordAuthFailure(normalizedEmail);
    return { ok: false, error: 'El correo electrónico o la contraseña son incorrectos.' };
  }

  await clearAuthFailures(normalizedEmail);
  await createLegacyPortalSession(client.id);
  return { ok: true };
}

export async function logoutLegacyPortal(): Promise<void> {
  await clearLegacyPortalSession();
}
