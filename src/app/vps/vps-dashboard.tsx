"use client";

import { useState } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useVpsStatus } from "@/lib/vps-swr";
import type { VpsProject } from "@/lib/vps-types";
import { ServerStatsHeader } from "./components/server-stats-header";
import { ProjectCard } from "./components/project-card";
import { LogsSheet } from "./components/logs-sheet";

function StatCardSkeleton() {
  return (
    <div className="rounded-2xl border border-zinc-800/50 bg-zinc-900/40 p-5 backdrop-blur-xl">
      <Skeleton className="h-3 w-16 bg-zinc-800/80" />
      <Skeleton className="mt-3 h-8 w-28 bg-zinc-800/80" />
      <Skeleton className="mt-4 h-1.5 w-full bg-zinc-800/80" />
    </div>
  );
}

function ProjectCardSkeleton() {
  return (
    <div className="rounded-2xl border border-zinc-800/50 bg-zinc-900/40 p-5 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-40 bg-zinc-800/80" />
        <Skeleton className="h-5 w-16 bg-zinc-800/80" />
      </div>
      <Skeleton className="mt-3 h-4 w-48 bg-zinc-800/80" />
      <Skeleton className="mt-6 h-4 w-full bg-zinc-800/80" />
      <Skeleton className="mt-2 h-4 w-3/4 bg-zinc-800/80" />
      <div className="mt-8 flex gap-1.5">
        <Skeleton className="h-8 w-20 bg-zinc-800/80" />
        <Skeleton className="h-8 w-20 bg-zinc-800/80" />
        <Skeleton className="h-8 w-20 bg-zinc-800/80" />
      </div>
    </div>
  );
}

export function VpsDashboard() {
  const { data, error, isLoading, mutate, isValidating } = useVpsStatus();
  const [logsProject, setLogsProject] = useState<VpsProject | null>(null);
  const [logsOpen, setLogsOpen] = useState(false);

  const openLogs = (project: VpsProject) => {
    setLogsProject(project);
    setLogsOpen(true);
  };

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-8 lg:px-10">
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-poppins text-3xl font-bold tracking-tight text-zinc-50">
            DevOps
          </h1>
          <p className="mt-1 font-roboto text-sm text-zinc-500">
            Infraestructura VPS · auto-refresh 15 s
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => mutate()}
          disabled={isValidating}
          className="gap-2 border border-zinc-800/70 bg-zinc-900/40 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-50"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${isValidating ? "animate-spin" : ""}`}
          />
          Refrescar
        </Button>
      </header>

      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/5 p-5 backdrop-blur-xl">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
          <div className="flex-1">
            <p className="font-poppins font-semibold text-red-200">
              VPS no responde
            </p>
            <p className="mt-1 font-roboto text-sm text-red-300/80">
              {error instanceof Error ? error.message : String(error)}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => mutate()}
            className="border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20 hover:text-red-100"
          >
            Reintentar
          </Button>
        </div>
      )}

      <section className="mb-8">
        {isLoading || !data ? (
          <div className="grid gap-4 md:grid-cols-3">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
        ) : (
          <ServerStatsHeader server={data.server} />
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-poppins text-lg font-semibold text-zinc-200">
            Proyectos
          </h2>
          {data && (
            <span className="font-roboto text-xs text-zinc-500">
              {data.projects.length} total ·{" "}
              {data.projects.filter((p) => p.active).length} activos
            </span>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {isLoading && !data
            ? Array.from({ length: 6 }).map((_, i) => (
                <ProjectCardSkeleton key={i} />
              ))
            : data?.projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onOpenLogs={openLogs}
                  onMutated={() => mutate()}
                />
              ))}
        </div>
      </section>

      <LogsSheet
        project={logsProject}
        open={logsOpen}
        onOpenChange={setLogsOpen}
      />
    </div>
  );
}
