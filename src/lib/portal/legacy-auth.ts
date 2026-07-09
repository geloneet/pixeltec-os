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

  // HOTFIX seguridad (2026-07-09, code review): este portal es SOLO para
  // clientes source='portal' — clientes source='crm_blob' usan el portal
  // por token (ver PortalTab.tsx), que sí valida por id único. `email` NO
  // tiene constraint único en `clients` (tabla multi-tenant, ownerId), así
  // que además de filtrar por source pedimos hasta 2 filas: si hay más de
  // una coincidencia (dos clientes distintos con el mismo correo) el login
  // se rechaza explícitamente en vez de autenticar contra una fila elegida
  // al azar por Postgres — evita filtrar el portal de un cliente a otro.
  const matches = await db
    .select({
      id: clients.id,
      passwordHash: clients.legacyPasswordHash,
      enabled: clients.legacyPortalEnabled,
    })
    .from(clients)
    .where(and(eq(clients.source, 'portal'), sql`lower(${clients.email}) = ${normalizedEmail}`))
    .limit(2);

  if (matches.length > 1) {
    console.error('[portal-legacy] ambiguous email match on login, refusing:', normalizedEmail);
    await recordAuthFailure(normalizedEmail);
    return {
      ok: false,
      error: 'No pudimos verificar tu cuenta de forma segura. Contacta a soporte.',
    };
  }

  const client = matches[0];
  if (!client?.passwordHash || !client.enabled) {
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
