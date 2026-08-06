"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { CRMClient } from "@/types/crm";
import { deriveProjectStats } from "@/lib/crm/client-stats";
import { ProjectCardShared } from "../ProjectCardShared";
import { listClientDefinitionsAction } from "@/app/(admin)/proyectos/definicion/actions";
import type { DefinitionListItem } from "@/lib/db/repos/definitions";
import { pickContinuableDefinition } from "@/lib/definition/continuable";
import { DefinitionStatusBadge } from "@/components/definition/DefinitionStatusBadge";

type ModalPayload = { type: string; data?: Record<string, string> } | null;

interface Props {
  client: CRMClient;
  navigateToProject: (clientId: string, projectId: string) => void;
  setModal: (m: ModalPayload) => void;
}

function relativeTime(dateStr: string): string {
  try { return formatDistanceToNow(new Date(dateStr), { locale: es, addSuffix: true }); }
  catch { return "—"; }
}

function exactDate(dateStr: string): string {
  try { return format(new Date(dateStr), "d MMM yyyy, HH:mm", { locale: es }); }
  catch { return dateStr; }
}

// ── Definiciones ──────────────────────────────────────────────────────────────

function DefinitionsSection({ definitions }: { definitions: DefinitionListItem[] }) {
  if (definitions.length === 0) return null;

  return (
    <div className="mb-6">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Definiciones
      </h4>
      <div className="grid gap-2">
        {definitions.map((d) => (
          <Link
            key={d.id}
            href={`/proyectos/definicion/${d.id}`}
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3.5 py-2.5 transition-colors hover:border-cyan-400/30 hover:bg-secondary/40"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{d.title}</p>
              <p className="text-[11px] text-muted-foreground">
                {relativeTime(d.updatedAt.toString())}
              </p>
            </div>
            <DefinitionStatusBadge status={d.status} currentStation={d.currentStation} />
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── ProyectosTab ──────────────────────────────────────────────────────────────

export function ProyectosTab({ client, navigateToProject, setModal }: Props) {
  const [definitions, setDefinitions] = useState<DefinitionListItem[]>([]);

  const loadDefinitions = useCallback(async () => {
    const r = await listClientDefinitionsAction(client.id);
    if (r.success && r.data) {
      setDefinitions(r.data.definitions);
    } else {
      console.error("[listClientDefinitionsAction]", r.error);
    }
  }, [client.id]);

  useEffect(() => { loadDefinitions(); }, [loadDefinitions]);

  const projectsWithStats = useMemo(
    () => client.projects.map(p => ({ project: p, stats: deriveProjectStats(p) })),
    [client.projects],
  );

  const continuable = useMemo(() => pickContinuableDefinition(definitions), [definitions]);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <DefinitionsSection definitions={definitions} />

      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Proyectos</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{client.projects.length} proyecto{client.projects.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          {continuable ? (
            <>
              <Link
                href={`/proyectos/definicion/${continuable.id}`}
                className="flex items-center gap-1.5 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-300 transition-colors hover:bg-cyan-500/20"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Continuar {continuable.title}
              </Link>
              <Link
                href={`/proyectos/definicion/nueva?client=${encodeURIComponent(client.id)}&name=${encodeURIComponent(client.name)}`}
                className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Nuevo Proyecto
              </Link>
            </>
          ) : (
            <Link
              href={`/proyectos/definicion/nueva?client=${encodeURIComponent(client.id)}&name=${encodeURIComponent(client.name)}`}
              className="flex items-center gap-1.5 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-300 transition-colors hover:bg-cyan-500/20"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Nuevo Proyecto
            </Link>
          )}
          <button
            onClick={() => setModal({ type: "addProject", data: { clientId: client.id } })}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/40 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            Registrar proyecto existente
          </button>
        </div>
      </div>

      {client.projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-sm font-medium text-muted-foreground mb-1">Sin proyectos</p>
          <p className="text-xs text-muted-foreground">Agrega el primer proyecto para este cliente.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projectsWithStats.map(({ project, stats }) => (
            <ProjectCardShared
              key={project.id}
              project={project}
              stats={stats}
              clientId={client.id}
              navigateToProject={navigateToProject}
              setModal={setModal}
            />
          ))}
        </div>
      )}
    </div>
  );
}
