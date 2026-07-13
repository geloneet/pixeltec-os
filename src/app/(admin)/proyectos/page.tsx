import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FolderKanban } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { getSessionUid } from "@/lib/auth/session";
import { getAllActiveProjects } from "./actions";
import type { ActiveProject } from "@/lib/hoy/types";

export const metadata: Metadata = {
  title: "Proyectos — PixelTEC OS",
};

function ProjectCard({ project }: { project: ActiveProject }) {
  const lastActivity = project.lastActivityAt
    ? formatDistanceToNow(new Date(project.lastActivityAt), {
        addSuffix: true,
        locale: es,
      })
    : "Sin actividad registrada";

  return (
    <Link
      href={`/proyectos/${project.id}`}
      className="flex flex-col gap-2 rounded-xl border border-white/[0.06] bg-zinc-900/30 p-5 transition-colors hover:border-cyan-400/30 hover:bg-white/[0.04]"
    >
      <div className="flex items-center gap-2">
        <FolderKanban
          className="h-4 w-4 flex-shrink-0 text-cyan-300"
          strokeWidth={1.75}
        />
        <h2 className="truncate text-sm font-semibold text-zinc-100">
          {project.name}
        </h2>
      </div>
      <p className="truncate text-xs text-zinc-500">
        {project.clientName}
        {project.domain ? ` · ${project.domain}` : ""}
      </p>
      <p className="mt-auto pt-1 text-[11px] text-zinc-600">{lastActivity}</p>
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
        <h1 className="text-2xl font-semibold text-zinc-100">Proyectos</h1>
        <p className="text-sm text-zinc-500">
          Estado de todos los proyectos activos
        </p>
      </header>

      {projects.length === 0 ? (
        <p className="py-16 text-center text-sm text-zinc-500">
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
