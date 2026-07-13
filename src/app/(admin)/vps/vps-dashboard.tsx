"use client";

import { useState } from "react";
import { AlertCircle, RefreshCw, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useVpsStatus, useVpsSnapshot } from "@/lib/vps-swr";
import type { VpsProject } from "@/lib/vps-types";
import { ServerStatsHeader } from "./components/server-stats-header";
import { ProjectCard } from "./components/project-card";
import { LogsSheet } from "./components/logs-sheet";
import { HealthPanels } from "./components/health-panels";
import { VpsActionBar } from "./components/action-bar";
import { getNavLabel } from "@/components/nav/command-palette-items";

function StatCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border/50 bg-card/40 p-5 backdrop-blur-xl">
      <Skeleton className="h-3 w-16 bg-secondary/80" />
      <Skeleton className="mt-3 h-8 w-28 bg-secondary/80" />
      <Skeleton className="mt-4 h-1.5 w-full bg-secondary/80" />
    </div>
  );
}

function HealthPanelSkeleton() {
  return (
    <div className="rounded-2xl border border-border/50 bg-card/40 p-5 backdrop-blur-xl">
      <Skeleton className="h-5 w-40 bg-secondary/80" />
      <Skeleton className="mt-4 h-4 w-full bg-secondary/80" />
      <Skeleton className="mt-2 h-4 w-3/4 bg-secondary/80" />
      <Skeleton className="mt-2 h-4 w-1/2 bg-secondary/80" />
    </div>
  );
}

function ProjectCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border/50 bg-card/40 p-5 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-40 bg-secondary/80" />
        <Skeleton className="h-5 w-16 bg-secondary/80" />
      </div>
      <Skeleton className="mt-3 h-4 w-48 bg-secondary/80" />
      <Skeleton className="mt-6 h-4 w-full bg-secondary/80" />
      <Skeleton className="mt-2 h-4 w-3/4 bg-secondary/80" />
      <div className="mt-8 flex gap-1.5">
        <Skeleton className="h-8 w-20 bg-secondary/80" />
        <Skeleton className="h-8 w-20 bg-secondary/80" />
        <Skeleton className="h-8 w-20 bg-secondary/80" />
      </div>
    </div>
  );
}

export function VpsDashboard() {
  const { data, error, isLoading, mutate, isValidating } = useVpsStatus();
  const vpsError = error as (Error & { status?: number }) | undefined;
  const {
    data: snapshot,
    error: snapshotError,
    isLoading: snapshotLoading,
  } = useVpsSnapshot();
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
          <h1 className="font-poppins text-3xl font-bold tracking-tight text-foreground">
            {getNavLabel("/vps")}
          </h1>
          <p className="mt-1 font-roboto text-sm text-muted-foreground">
            Infraestructura VPS · auto-refresh 15 s
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => mutate()}
          disabled={isValidating}
          className="gap-2 border border-border/70 bg-card/40 text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${isValidating ? "animate-spin" : ""}`}
          />
          Refrescar
        </Button>
      </header>

      <div className="mb-8">
        <VpsActionBar />
      </div>

      {vpsError && (vpsError.status === 401 || vpsError.status === 403) ? (
        <div className="mb-6 flex items-start gap-4 rounded-2xl border border-border/50 bg-card/40 p-6 backdrop-blur-xl">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary/60">
            <Server className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="font-poppins font-semibold text-foreground">
              Sesión no autorizada
            </p>
            <p className="mt-1 font-roboto text-sm text-muted-foreground">
              {vpsError.status === 403
                ? "Tu cuenta no tiene permisos para ver la infraestructura. Contacta al administrador."
                : "Tu sesión expiró o no es válida. Cierra sesión y vuelve a entrar para continuar."}
            </p>
          </div>
        </div>
      ) : vpsError ? (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/5 p-5 backdrop-blur-xl">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
          <div className="flex-1">
            <p className="font-poppins font-semibold text-red-200">
              VPS no responde
            </p>
            <p className="mt-1 font-roboto text-sm text-red-300/80">
              {vpsError.message}
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
      ) : null}

      {!vpsError && (
        <>
          <section className="mb-8">
            {isLoading && !data ? (
              <div className="grid gap-4 md:grid-cols-3">
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
              </div>
            ) : data ? (
              <ServerStatsHeader server={data.server} />
            ) : null}
          </section>

          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-poppins text-lg font-semibold text-foreground">
                Proyectos
              </h2>
              {data && (
                <span className="font-roboto text-xs text-muted-foreground">
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
        </>
      )}

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-poppins text-lg font-semibold text-foreground">
            Salud del VPS
          </h2>
          {snapshot && (
            <span className="font-roboto text-xs text-muted-foreground">
              Actualizado {new Date(snapshot.generatedAt).toLocaleTimeString("es-MX")}
            </span>
          )}
        </div>

        {snapshotError ? (
          <div className="flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/5 p-5 backdrop-blur-xl">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
            <div className="flex-1">
              <p className="font-poppins font-semibold text-red-200">
                No se pudo cargar la salud del VPS
              </p>
              <p className="mt-1 font-roboto text-sm text-red-300/80">
                {(snapshotError as Error).message}
              </p>
            </div>
          </div>
        ) : snapshotLoading && !snapshot ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <HealthPanelSkeleton key={i} />
            ))}
          </div>
        ) : snapshot ? (
          <HealthPanels snapshot={snapshot} />
        ) : null}
      </section>

      <LogsSheet
        project={logsProject}
        open={logsOpen}
        onOpenChange={setLogsOpen}
      />
    </div>
  );
}
