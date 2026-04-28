export function ReportStatusCard() {
  return (
    <div
      className="rounded-lg p-4 flex flex-col gap-3"
      style={{
        background: 'rgba(245,158,11,0.04)',
        border:     '1px dashed rgba(245,158,11,0.3)',
      }}
    >
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-green-400" />
        <h3 className="text-sm font-medium text-amber-400/80">Reporte semanal</h3>
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-xs text-zinc-400">Domingo 12:00 PM</p>
        <p className="text-[11px] text-zinc-500">
          El bot enviará un resumen de la semana a Telegram.
        </p>
      </div>

      <div className="mt-auto pt-2 border-t border-amber-500/10">
        <p className="text-[10px] text-zinc-500">Bot conectado · @pixeltec_bot</p>
        <p className="text-[10px] text-amber-500/50">Pendiente de Fase 4</p>
      </div>
    </div>
  );
}
