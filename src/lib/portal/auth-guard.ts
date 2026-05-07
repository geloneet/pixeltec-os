import { refreshPortalSession } from './session-server';
import { logSecurityEvent } from './security-log';

export class PortalAuthError extends Error {
  constructor(public readonly reason: 'no-session' | 'slug-mismatch' | 'expired') {
    super(`Portal auth failed: ${reason}`);
  }
}

/**
 * Verifies a valid portal session cookie exists for the given slug and renews it
 * (sliding expiration). Call at the top of every server action that serves client data.
 *
 * Logging is fire-and-forget (no await) to avoid delaying the error response
 * and to prevent timing side-channels between valid and invalid sessions.
 */
export async function requirePortalSession(expectedSlug: string) {
  const session = await refreshPortalSession();

  if (!session) {
    // Fire-and-forget: AsyncLocalStorage propagates request context to child Promises
    logSecurityEvent({ type: 'auth-no-session', slug: expectedSlug }).catch(() => {});
    throw new PortalAuthError('no-session');
  }

  if (session.slug !== expectedSlug) {
    logSecurityEvent({
      type:         'auth-slug-mismatch',
      slug:         expectedSlug,
      resolvedSlug: session.slug,
    }).catch(() => {});
    throw new PortalAuthError('slug-mismatch');
  }

  return session; // { clientId, slug, iat, exp }
}
