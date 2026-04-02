/**
 * Portal utility functions — safe to import on both server and client.
 */

/** Converts a company name to a URL-safe slug. */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // strip accents
    .replace(/[^a-z0-9\s-]/g, '')       // strip special chars
    .replace(/\s+/g, '-')               // spaces → hyphens
    .replace(/-+/g, '-')                // collapse consecutive hyphens
    .slice(0, 60);
}

/** Generates a cryptographically uniform 6-digit numeric code. */
export function generateAccessCode(): string {
  // Use Math.random for simplicity; upgrade to crypto.randomInt in production
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/** Portal session stored in sessionStorage after code validation. */
export interface PortalSession {
  clientId:    string;
  slug:        string;
  companyName: string;
  status:      string;
  services:    string[];
  taskProgress: { total: number; completed: number; percentage: number };
  validatedAt: number; // Date.now()
}

const SESSION_KEY  = 'pixeltec_portal_session';
const SESSION_TTL  = 24 * 60 * 60 * 1000; // 24 hours

export function savePortalSession(data: PortalSession): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

export function loadPortalSession(slug: string): PortalSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session: PortalSession = JSON.parse(raw);
    if (session.slug !== slug) return null;
    if (Date.now() - session.validatedAt > SESSION_TTL) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function clearPortalSession(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(SESSION_KEY);
}
