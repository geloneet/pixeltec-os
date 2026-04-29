import type { AlertPayload, AlertSeverity } from './types';

const EMOJI: Record<AlertSeverity, string> = {
  info: 'ℹ️',
  warn: '⚠️',
  error: '🚨',
  critical: '🔥',
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function formatAlert(payload: AlertPayload): string {
  const emoji = EMOJI[payload.severity];
  const lines: string[] = [
    `${emoji} <b>${escapeHtml(payload.title)}</b>`,
    `<i>${escapeHtml(payload.source)}</i> · ${payload.severity}`,
    '',
    escapeHtml(payload.message),
  ];

  if (payload.metadata && Object.keys(payload.metadata).length > 0) {
    lines.push('');
    for (const [k, v] of Object.entries(payload.metadata)) {
      lines.push(`<code>${escapeHtml(k)}</code>: ${escapeHtml(String(v))}`);
    }
  }

  lines.push('');
  lines.push(`<i>${new Date().toISOString()}</i>`);
  return lines.join('\n');
}
