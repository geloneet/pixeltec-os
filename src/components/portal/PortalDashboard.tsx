"use client";
import type { CRMProject } from "@/types/crm";
import type { Strategy } from "@/types/documents";

interface Props {
  project: CRMProject | null;
  strategy: Strategy | null;
}

export default function PortalDashboard({ project, strategy }: Props) {
  const totalTasks = project?.tasks.length ?? 0;
  const completedTasks =
    project?.tasks.filter(t => t.status === "completado").length ?? 0;
  const progressPct =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const nextMilestone =
    strategy?.roadmap.find(r => r.status !== "completado") ?? null;

  const nextCharge =
    project?.charges.filter(c => c.active)[0] ?? null;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {/* Card 1: Progreso */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Progreso del proyecto
        </p>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-2xl font-bold text-white">{progressPct}%</span>
            <span className="text-xs text-zinc-500">
              {completedTasks} / {totalTasks}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-cyan-400 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-xs text-zinc-500">
            {completedTasks} de {totalTasks} tareas completadas
          </p>
        </div>
      </div>

      {/* Card 2: Próximo hito */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Próximo hito
        </p>
        {nextMilestone ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-white leading-snug">
              {nextMilestone.title}
            </p>
            <span className="inline-block rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400 border border-zinc-700">
              {nextMilestone.sprint}
            </span>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">Sin hitos pendientes</p>
        )}
      </div>

      {/* Card 3: Próximo cobro */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Próximo cobro
        </p>
        {nextCharge ? (
          <div className="space-y-1">
            <p className="text-sm font-medium text-white">{nextCharge.concept}</p>
            <p className="text-lg font-bold text-cyan-400">${nextCharge.amount}</p>
            <p className="text-xs text-zinc-500 capitalize">{nextCharge.frequency === "monthly" ? "Mensual" : "Anual"}</p>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">Sin cobros programados</p>
        )}
      </div>
    </div>
  );
}
