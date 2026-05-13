'use client';

import type { AssistantWeeklyReportSerialized } from '@/lib/assistant/types';

interface Props {
  lastReport: AssistantWeeklyReportSerialized | null;
}

function formatRelative(iso: string): string {
  const ts = new Date(iso).getTime();
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'hace unos segundos';
  if (min < 60) return `hace ${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `hace ${hr}h`;
  const days = Math.floor(hr / 24);
  return `hace ${days}d`;
}

function deliveryStatus(report: AssistantWeeklyReportSerialized): {
  text: string;
  className: string;
} {
  if (report.whatsappSentAt) {
    return {
      text: `✓ WhatsApp · ${formatRelative(report.whatsappSentAt)}`,
      className: 'text-green-400',
    };
  }
  if (report.whatsappError) {
    return { text: '⚠ Error al enviar', className: 'text-rose-400' };
  }
  if (report.telegramSentAt) {
    return { text: '✓ Telegram (legacy)', className: 'text-zinc-400' };
  }
  return { text: 'Pendiente de envío', className: 'text-amber-500/70' };
}

export function LastWeekReportCard({ lastReport }: Props) {
  if (!lastReport) {
    return (
      <div
        className="rounded-lg p-4 flex flex-col gap-3"
        style={{
          background: 'rgba(245,158,11,0.04)',
          border: '1px dashed rgba(245,158,11,0.3)',
        }}
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-400/60" />
          <h3 className="text-sm font-medium text-amber-400/80">Reporte semanal</h3>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-xs text-zinc-400">Próximo rollover: domingo 12:00 PM</p>
          <p className="text-[11px] text-zinc-500">
            Aún no hay reportes generados. El cron archivará la semana y generará la próxima automáticamente.
          </p>
        </div>
        <div className="mt-auto pt-2 border-t border-amber-500/10">
          <p className="text-[10px] text-zinc-500">Notifica vía WhatsApp al completar el rollover.</p>
        </div>
      </div>
    );
  }

  const { weekKey, totals } = lastReport;
  const [, weekNum] = weekKey.split('-W');
  const pct = totals.total > 0
    ? Math.round((totals.completed / totals.total) * 100)
    : 0;
  const delivery = deliveryStatus(lastReport);

  return (
    <div
      className="rounded-lg p-4 flex flex-col gap-3"
      style={{
        background: 'rgba(34,197,94,0.03)',
        border: '1px solid rgba(34,197,94,0.15)',
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400" />
          <h3 className="text-sm font-medium text-zinc-200">Semana {weekNum}</h3>
        </div>
        <span className="text-[10px] text-zinc-500">{lastReport.generatedBy === 'cron' ? 'Auto' : 'Manual'}</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col">
          <span className="text-lg font-semibold text-green-400">{totals.completed}</span>
          <span className="text-[10px] text-zinc-500">completadas</span>
        </div>
        <div className="flex flex-col">
          <span className="text-lg font-semibold text-zinc-300">{totals.total}</span>
          <span className="text-[10px] text-zinc-500">total</span>
        </div>
        <div className="flex flex-col">
          <span className="text-lg font-semibold text-amber-400">{totals.postponed}</span>
          <span className="text-[10px] text-zinc-500">pospuestas</span>
        </div>
      </div>

      <div className="mt-auto pt-2 border-t border-white/[0.05] flex items-center justify-between">
        <span className="text-[10px] text-zinc-500">{pct}% completado</span>
        <span
          className={`text-[10px] ${delivery.className}`}
          title={lastReport.whatsappError ?? undefined}
        >
          {delivery.text}
        </span>
      </div>
    </div>
  );
}
