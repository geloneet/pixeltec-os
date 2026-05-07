import { refreshPortalSession } from './session-server';

export class PortalAuthError extends Error {
  constructor(public readonly reason: 'no-session' | 'slug-mismatch' | 'expired') {
    super(`Portal auth failed: ${reason}`);
  }
}

/**
 * Verifies a valid portal session cookie exists for the given slug and renews it
 * (sliding expiration). Call at the top of every server action that serves client data.
 */
export async function requirePortalSession(expectedSlug: string) {
  const session = await refreshPortalSession();
  if (!session) throw new PortalAuthError('no-session');
  if (session.slug !== expectedSlug) throw new PortalAuthError('slug-mismatch');
  return session; // { clientId, slug, iat, exp }
}
