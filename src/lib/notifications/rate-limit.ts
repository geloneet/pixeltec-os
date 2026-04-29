const RATE_LIMIT_MS = 5 * 60 * 1000;
const lastSent = new Map<string, number>();

export function checkRateLimit(source: string, severity: string): boolean {
  if (severity === 'critical') return true;

  const key = `${source}:${severity}`;
  const now = Date.now();
  const last = lastSent.get(key) ?? 0;

  if (now - last < RATE_LIMIT_MS) return false;

  lastSent.set(key, now);
  return true;
}
