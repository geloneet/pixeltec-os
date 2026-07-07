/**
 * Centralized security event logging for the OTP portal.
 *
 * Writes to Firestore collection `portalSecurityEvents`.
 * TTL policy (90 days) configured manually by the admin in Firebase Console.
 *
 * NOTA: eventos creados antes de la v1 de este módulo pueden tener schema
 * previo (campo `attemptedSlug` en vez de `slug`). El widget de visualización
 * debe leer ambos campos como fallback.
 *
 * NEVER log: cookie value, HMAC secret, OTP code, clientId from cookie payload.
 * OK to log: slug (public URL segment), resolvedSlug, IP, truncated userAgent.
 */

import { headers } from 'next/headers';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export type PortalSecurityEventType =
  | 'auth-no-session'         // requirePortalSession: no cookie present
  | 'auth-slug-mismatch'      // requirePortalSession: cookie slug ≠ expected slug
  | 'auth-expired'            // requirePortalSession: cookie exp < now (covered by no-session)
  | 'migration-slug-mismatch' // migratePortalSessionAction: clientId.slug ≠ claimed slug
  | 'otp-rate-limit-ip'       // requestPortalCodeAction: IP exceeded hourly limit
  | 'otp-invalid-code'        // verifyPortalCodeAction: code mismatch
  | 'otp-expired-code';       // verifyPortalCodeAction: code expired

interface SecurityEventInput {
  type:           PortalSecurityEventType;
  slug?:          string; // slug attempted (public URL segment — safe to log)
  resolvedSlug?:  string; // real slug of the clientId (only for mismatch events)
  reason?:        string; // extra context, no sensitive data
}

/**
 * Fire-and-forget-safe: always catches internally so it never breaks the
 * calling request. In production, failures are silent. In dev, they print
 * to stderr so misconfiguration is visible.
 */
export async function logSecurityEvent(input: SecurityEventInput): Promise<void> {
  try {
    // headers() is safe here even in fire-and-forget callers because Next.js
    // AsyncLocalStorage propagates the request context to child Promises.
    const h = await headers();
    const ip = h.get('x-forwarded-for')?.split(',')[0].trim()
            ?? h.get('x-real-ip')
            ?? 'unknown';
    const ua = (h.get('user-agent') ?? 'unknown').slice(0, 200);

    await getAdminFirestore().collection('portalSecurityEvents').add({
      type:         input.type,
      slug:         input.slug         ?? null,
      resolvedSlug: input.resolvedSlug ?? null,
      reason:       input.reason       ?? null,
      ip,
      userAgent:    ua,
      createdAt:    FieldValue.serverTimestamp(),
    });
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[security-log] write failed — check PORTAL_SESSION_SECRET and Firestore config');
    }
  }
}
