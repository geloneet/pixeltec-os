"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import type { WorkSession } from "@/types/session";

interface Props {
  session: WorkSession;
  onFinalize: () => void;
}

export function WorkspaceHeader({ session, onFinalize }: Props) {
  const router = useRouter();

  return (
    <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#0F0F12] px-6 py-4">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push(`/proyectos/${session.projectId}?tab=tareas`)}
          className="flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver
        </button>
        <div className="h-4 w-px bg-white/[0.08]" />
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span>{session.clientName}</span>
          <span className="text-zinc-700">·</span>
          <span>{session.projectName}</span>
          <span className="text-zinc-700">·</span>
          <span className="font-medium text-zinc-300">{session.taskName}</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs font-medium text-green-400">Sesión activa</span>
        </div>
        <button
          onClick={onFinalize}
          className="rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3 py-1.5 text-xs font-medium text-red-400 transition-all hover:bg-red-500/10 hover:border-red-500/30"
        >
          Finalizar sesión
        </button>
      </div>
    </div>
  );
}
