export function ReportStatusCard() {
  return (
    <div
      className="rounded-lg p-4 flex flex-col gap-3"
      style={{
        background: 'rgba(34,197,94,0.03)',
        border:     '1px solid rgba(34,197,94,0.15)',
      }}
    >
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-green-400" />
        <h3 className="text-sm font-medium text-zinc-200">Reporte semanal</h3>
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-xs text-zinc-400">Domingo 12:00 PM</p>
        <p className="text-[11px] text-zinc-500">
          El cron archiva la semana, genera la próxima y envía un resumen vía WhatsApp.
        </p>
      </div>

      <div className="mt-auto pt-2 border-t border-white/[0.05]">
        <p className="text-[10px] text-zinc-500">Transport: WhatsApp Cloud API · ventana 24h aplica</p>
      </div>
    </div>
  );
}
