import Link from "next/link";
import { FolderKanban } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import type { ActiveProject } from "@/lib/hoy/types";

export function ActiveProjectsPanel({ projects }: { projects: ActiveProject[] }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <header className="mb-4 flex items-center gap-2">
        <FolderKanban className="h-4 w-4 text-cyan-300" strokeWidth={1.75} />
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Proyectos activos
        </h2>
      </header>

      {projects.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Aún no hay proyectos registrados.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                href={`/proyectos/${project.id}`}
                className="flex items-center gap-3 rounded-lg border border-transparent bg-transparent px-3 py-2.5 transition-colors hover:border-cyan-400/30 hover:bg-secondary/60"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {project.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {project.clientName}
                    {project.domain ? ` · ${project.domain}` : ""}
                  </p>
                </div>
                {project.lastActivityAt && (
                  <span className="flex-shrink-0 text-[11px] text-muted-foreground/70">
                    {formatDistanceToNow(new Date(project.lastActivityAt), {
                      addSuffix: true,
                      locale: es,
                    })}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
