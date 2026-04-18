"use client";

import { ExternalLink, HardDrive } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProjectType, VpsProject } from "@/lib/vps-types";
import { parseStatus } from "@/lib/vps-types";
import { StatusDot } from "./status-dot";
import { ProjectActions } from "./project-actions";

const TYPE_BADGE: Record<ProjectType, string> = {
  docker: "bg-blue-500/10 text-blue-300 border-blue-500/30",
  "docker-compose": "bg-indigo-500/10 text-indigo-300 border-indigo-500/30",
  pm2: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  manual: "bg-zinc-500/10 text-zinc-300 border-zinc-500/30",
};

export function ProjectCard({
  project,
  onOpenLogs,
  onMutated,
}: {
  project: VpsProject;
  onOpenLogs: (project: VpsProject) => void;
  onMutated: () => void;
}) {
  const status = parseStatus(project.status, project.active);

  return (
    <article
      className={cn(
        "group relative flex min-h-[240px] flex-col gap-4 overflow-hidden rounded-2xl border border-zinc-800/50 bg-zinc-900/40 p-5 backdrop-blur-xl transition-all duration-300",
        "before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-zinc-600/50 before:to-transparent",
        "after:pointer-events-none after:absolute after:inset-0 after:bg-gradient-to-br after:from-white/[0.03] after:to-transparent after:opacity-0 after:transition-opacity after:duration-300 group-hover:after:opacity-100",
        "hover:border-zinc-700/70 hover:bg-zinc-900/60"
      )}
    >
      <header className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <StatusDot status={status} />
            <h3 className="truncate font-poppins font-semibold tracking-tight text-zinc-50">
              {project.name}
            </h3>
          </div>
          {project.domain ? (
            <a
              href={`https://${project.domain}`}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 font-roboto text-sm text-zinc-400 transition-colors hover:text-cyan-300"
            >
              {project.domain}
              <ExternalLink className="h-3 w-3 opacity-60" />
            </a>
          ) : (
            <p className="font-roboto text-sm text-zinc-500">
              Sin dominio público
            </p>
          )}
        </div>

        <span
          className={cn(
            "shrink-0 rounded-md border px-2 py-0.5 font-roboto text-[10px] font-medium uppercase tracking-wider",
            TYPE_BADGE[project.type] ?? TYPE_BADGE.manual
          )}
        >
          {project.type}
        </span>
      </header>

      <p className="relative line-clamp-2 font-roboto text-sm text-zinc-400">
        {project.description || "—"}
      </p>

      <div className="relative mt-auto flex items-center justify-between gap-3 border-t border-zinc-800/60 pt-3 font-roboto text-xs text-zinc-500">
        <span className="flex items-center gap-1.5">
          <HardDrive className="h-3 w-3" />
          {project.size}
        </span>
        <span className="truncate text-right text-zinc-500">
          {project.containerName || project.pm2Name || project.id}
        </span>
      </div>

      <div className="relative">
        <ProjectActions
          project={project}
          status={status}
          onMutated={onMutated}
          onOpenLogs={() => onOpenLogs(project)}
        />
      </div>
    </article>
  );
}
