import Link from "next/link";
import { FolderKanban } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { PanelCard } from "@/components/ui/panel-card";
import type { ProjectRow } from "@/lib/projects/queries";

export function ActiveProjectsPanel({ projects }: { projects: ProjectRow[] }) {
  return (
    <PanelCard icon={FolderKanban} title="Proyectos en curso">
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
                    {project.clientName} · {project.status}
                  </p>
                </div>
                <span className="flex-shrink-0 text-[11px] text-muted-foreground/70">
                  {formatDistanceToNow(new Date(project.createdAt), {
                    addSuffix: true,
                    locale: es,
                  })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PanelCard>
  );
}
