/**
 * PixelBot serializa timestamps de conversación como string canónico
 * 'YYYY-MM-DD HH:MM:SS' en UTC (agent/outbox/time_utils.py).
 */
export function parseCanonical(s: string): Date {
  return new Date(s.replace(' ', 'T') + 'Z');
}
