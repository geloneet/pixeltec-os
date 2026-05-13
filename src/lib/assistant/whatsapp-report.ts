/**
 * Pure renderer for the weekly assistant report.
 *
 * Takes an AssistantWeeklyReportDoc (or Serialized) and returns a plain
 * text body ready to feed into `sendWhatsApp(message)`. No I/O, no
 * Firestore reads — fully deterministic from its input so the rollover
 * step and the smoke-test endpoint produce byte-identical output.
 *
 * Output target: ~400-600 chars, well within Meta's 4096-char limit.
 *
 * Plain text only (no Markdown). Meta supports *bold* / _italic_ but
 * keeping the message sober reads better in chat than emoji noise.
 */

import type {
  AssistantWeeklyReportDoc,
  AssistantWeeklyReportSerialized,
  AssistantTaskCategory,
  ReportTotals,
} from './types';

type AnyReport = AssistantWeeklyReportDoc | AssistantWeeklyReportSerialized;

const TIMEZONE = 'America/Mexico_City';
const LOCALE = 'es-MX';

const CATEGORY_LABELS: Record<AssistantTaskCategory, string> = {
  trabajo:     'Trabajo',
  cliente:     'Cliente',
  personal:    'Personal',
  salud:       'Salud',
  aprendizaje: 'Aprendizaje',
};

const CATEGORY_ORDER: AssistantTaskCategory[] = [
  'trabajo',
  'cliente',
  'personal',
  'salud',
  'aprendizaje',
];

function toDate(value: Date | string | { toDate: () => Date }): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value);
  return value.toDate();
}

/** "5–11 may" for same month, "28 abr – 4 may" for cross-month, year suffix when spanning. */
function formatWeekRange(start: Date, end: Date): string {
  const month = new Intl.DateTimeFormat(LOCALE, { month: 'short', timeZone: TIMEZONE });
  const day = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', timeZone: TIMEZONE });
  const year = new Intl.DateTimeFormat(LOCALE, { year: 'numeric', timeZone: TIMEZONE });

  const startMonth = month.format(start).replace('.', '');
  const endMonth = month.format(end).replace('.', '');
  const startDay = day.format(start);
  const endDay = day.format(end);
  const startYear = year.format(start);
  const endYear = year.format(end);

  if (startYear !== endYear) {
    return `${startDay} ${startMonth} ${startYear} – ${endDay} ${endMonth} ${endYear}`;
  }
  if (startMonth === endMonth) {
    return `${startDay}–${endDay} ${startMonth}`;
  }
  return `${startDay} ${startMonth} – ${endDay} ${endMonth}`;
}

function formatGeneratedAt(d: Date): string {
  const weekday = new Intl.DateTimeFormat(LOCALE, { weekday: 'short', timeZone: TIMEZONE }).format(d);
  const time = new Intl.DateTimeFormat(LOCALE, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: TIMEZONE,
  }).format(d);
  return `${weekday.replace('.', '')} ${time}`;
}

function pct(part: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((part / total) * 100);
}

function categoryLine(label: string, t: ReportTotals): string | null {
  if (t.total === 0) return null;
  return `• ${label.padEnd(12, ' ')}${t.completed}/${t.total}`;
}

export function renderWeeklyReportMessage(
  report: AnyReport,
  _opts?: { weekNumber?: number },
): string {
  const start = toDate(report.weekStart);
  const end = toDate(report.weekEnd);
  const generatedAt = toDate(report.generatedAt);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://pixeltec.mx';
  const detailUrl = `${baseUrl}/asistente/historial/${report.weekKey}`;
  const generatedLine = `Generado: ${formatGeneratedAt(generatedAt)}`;

  // Empty-week short-circuit
  if (report.totals.total === 0) {
    return [
      '📊 PixelTEC OS — Reporte semanal',
      '',
      `Semana: ${report.weekKey} (${formatWeekRange(start, end)})`,
      '',
      'Semana sin tareas planificadas. ¿Quieres agregar plantillas?',
      '',
      generatedLine,
      `Ver detalle: ${detailUrl}`,
      '',
    ].join('\n');
  }

  const t = report.totals;
  const percent = pct(t.completed, t.total);

  const categoryLines = CATEGORY_ORDER.map((cat) =>
    categoryLine(CATEGORY_LABELS[cat], report.byCategory[cat]),
  ).filter((line): line is string => line !== null);

  const lines: string[] = [
    '📊 PixelTEC OS — Reporte semanal',
    '',
    `Semana: ${report.weekKey} (${formatWeekRange(start, end)})`,
    `Completadas: ${t.completed} / ${t.total}  (${percent}%)`,
  ];

  if (t.postponed > 0) lines.push(`Pospuestas:  ${t.postponed}`);
  if (t.cancelled > 0) lines.push(`Canceladas:  ${t.cancelled}`);
  if (t.pending > 0) lines.push(`Pendientes:  ${t.pending}`);

  if (categoryLines.length > 0) {
    lines.push('');
    lines.push('Por categoría:');
    lines.push(...categoryLines);
  }

  lines.push('');
  lines.push(generatedLine);
  lines.push(`Ver detalle: ${detailUrl}`);
  lines.push('');

  return lines.join('\n');
}
