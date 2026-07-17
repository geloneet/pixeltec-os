import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FolderKanban, Sparkles, Wand2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { getSessionUid } from "@/lib/auth/session";
import { getAllActiveProjects } from "./actions";
import type { ActiveProject, ActiveProjectKind } from "@/lib/hoy/types";

export const metadata: Metadata = {
  title: "Proyectos — PixelTEC OS",
};

const KIND_ICON: Record<ActiveProjectKind, typeof FolderKanban> = {
  crm: FolderKanban,
  pixelforge: Wand2,
  definicion: Sparkles,
};

const KIND_LABEL: Record<ActiveProjectKind, string> = {
  crm: "Proyecto",
  pixelforge: "PixelForge",
  definicion: "Definición",
};

function ProjectCard({ project }: { project: ActiveProject }) {
  const lastActivity = project.lastActivityAt
    ? formatDistanceToNow(new Date(project.lastActivityAt), {
        addSuffix: true,
        locale: es,
      })
    : "Sin actividad registrada";
  const Icon = KIND_ICON[project.kind];

  return (
    <Link
      href={project.href}
      className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5 transition-colors hover:border-cyan-400/30 hover:bg-secondary/40"
    >
      <div className="flex items-center gap-2">
        <Icon
          className="h-4 w-4 flex-shrink-0 text-cyan-300"
          strokeWidth={1.75}
        />
        <h2 className="truncate text-sm font-semibold text-foreground">
          {project.name}
        </h2>
      </div>
      <p className="truncate text-xs text-muted-foreground">
        {project.clientName}
        {project.domain ? ` · ${project.domain}` : ""}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground/80">
        <span className="rounded bg-secondary/60 px-1.5 py-0.5">
          {KIND_LABEL[project.kind]}
        </span>
        {project.station && (
          <span className="rounded bg-secondary/60 px-1.5 py-0.5">{project.station}</span>
        )}
        {project.status && (
          <span className="rounded bg-secondary/60 px-1.5 py-0.5">{project.status}</span>
        )}
      </div>
      <p className="mt-auto pt-1 text-[11px] text-muted-foreground/60">{lastActivity}</p>
    </Link>
  );
}

export default async function ProyectosPage() {
  const uid = await getSessionUid();
  if (!uid) redirect("/login?redirect=/proyectos");

  const projects = await getAllActiveProjects();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Proyectos</h1>
        <p className="text-sm text-muted-foreground">
          Estado de todos los proyectos activos
        </p>
      </header>

      {projects.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Aún no hay proyectos registrados.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </div>
  );
}
