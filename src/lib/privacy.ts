/**
 * Privacy helpers — keep raw PII out of Firestore.
 *
 * The IP address of a visitor is PII under GDPR (Art. 4(1)). PixelTEC's
 * vigent aviso de privacidad does not authorize storing raw IP, so any
 * server action that needs to rate-limit or fingerprint a visitor must
 * persist a salted hash, never the original address.
 *
 * Required env:
 *   INTERNAL_IP_SALT — opaque random string, 32+ characters. Rotating it
 *     invalidates all existing rateLimit buckets and decouples leads.ipHash
 *     from any future bucket, which is intentional (and the right thing to
 *     do during an incident).
 *
 *   Generate one with:
 *     openssl rand -base64 48
 */

import { createHash } from 'crypto';

/**
 * Returns sha256(ip + INTERNAL_IP_SALT) hex-encoded, sliced to 32 chars.
 *
 * Caller contract:
 *   - `ip` is whatever survived header parsing (`x-forwarded-for`, `x-real-ip`,
 *     or the literal `'unknown'`); pass it as-is.
 *   - If INTERNAL_IP_SALT is missing the function throws — never silently
 *     fall back to an unsalted hash, that defeats the GDPR posture. The
 *     env-guard catches this earlier in any user-facing flow.
 *
 * ⚠ Salt rotation trade-off:
 *   Both `leads.ipHash` and the `rateLimit/{bucket__hash}` doc id derive
 *   from this single salt. Rotating INTERNAL_IP_SALT therefore has TWO
 *   simultaneous effects:
 *
 *     1. Legacy `leads.ipHash` becomes unlinkable to any future bucket —
 *        DESIRABLE after a PII incident (you want old hashes orphaned
 *        from the new namespace).
 *     2. All in-flight `rateLimit` buckets are invalidated — counters
 *        reset to zero, so traffic you had previously throttled or
 *        blocked can now pass through until the new buckets fill up.
 *
 *   For PixelTEC's volume and threat model, salt rotation is a rare
 *   event (probably never outside of an incident), so the simplicity of
 *   one shared salt wins. If you ever need to rotate the privacy hash
 *   without resetting rate-limit state (or vice-versa), split this into
 *   two envs — e.g. `INTERNAL_IP_SALT` for leads / persistence and a
 *   separate `RATE_LIMIT_SALT` for the bucket id — and update both
 *   callers (lib/leads-repo.ts and lib/rate-limit.ts).
 */
export function hashIp(ip: string): string {
  const salt = process.env.INTERNAL_IP_SALT;
  if (!salt) {
    throw new Error('INTERNAL_IP_SALT is not configured');
  }
  return createHash('sha256').update(`${ip}|${salt}`).digest('hex').slice(0, 32);
}
