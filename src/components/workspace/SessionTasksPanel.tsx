"use client";

import { CheckSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import type { CRMTask } from "@/types/crm";
import { STATUS_CONFIG, PRIORITIES } from "@/types/crm";
import { cn } from "@/lib/utils";

interface Props {
  tasks: CRMTask[];
  projectId: string;
}

// Tareas creadas durante ESTA sesión (vía "Convertir en tarea" en
// Observaciones) — sin esto quedaban invisibles: se creaban de verdad pero
// nada en el workspace de sesión mostraba que había pasado algo.
export function SessionTasksPanel({ tasks, projectId }: Props) {
  const router = useRouter();

  if (tasks.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="mb-3 text-xs font-semibold text-muted-foreground">
        Tareas creadas en esta sesión
        <span className="ml-2 rounded-full bg-cyan-500/10 px-1.5 py-0.5 text-[0.6rem] font-medium text-cyan-400">
          {tasks.length}
        </span>
      </p>

      <div className="space-y-2">
        {tasks.map((task) => {
          const statusCfg = STATUS_CONFIG[task.status];
          return (
            <button
              key={task.id}
              onClick={() => router.push(`/proyectos/${projectId}?tab=tareas`)}
              className="flex w-full items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-left transition-colors hover:border-border hover:bg-secondary/60"
            >
              <CheckSquare className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
              <span
                className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                style={{ backgroundColor: PRIORITIES[task.prio].color }}
              />
              <span className="flex-1 truncate text-xs text-foreground">{task.name}</span>
              <span className={cn("flex-shrink-0 rounded-full px-2 py-0.5 text-[0.6rem] font-medium", statusCfg.bg, statusCfg.text)}>
                {statusCfg.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
