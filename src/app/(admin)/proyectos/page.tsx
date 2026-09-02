import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth/session";
import { listProjects } from "@/lib/projects/queries";
import PageHeader from "@/components/dashboard/PageHeader";

export const metadata: Metadata = {
  title: "Trabajo — Pixeltec.mx",
};

const STATUS_TINT: Record<string, string> = {
  "Activo": "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  "En desarrollo": "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  "Pausado": "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  "Completado": "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
};

/**
 * "Trabajo" (WO-2026-00132) — sustituye Proyectos/Definición/PixelForge.
 * Lista simple: proyectos realizados y pendientes, con lo básico visible
 * (estatus, %). El detalle vive en /proyectos/[id].
 */
export default async function TrabajoPage() {
  const ownerId = await getSessionUserId();
  if (!ownerId) redirect("/login?redirect=/proyectos");

  const proyectos = await listProjects();
  const enCurso = proyectos.filter((p) => p.status !== "Completado");
  const completados = proyectos.filter((p) => p.status === "Completado");

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-8">
      <PageHeader title="Trabajo" description="Proyectos realizados y pendientes" />

      {proyectos.length === 0 ? (
        <div className="mt-8 rounded-xl border border-border bg-card p-10 text-center text-muted-foreground">
          Todavía no hay proyectos. Se crean automáticamente al aceptar una cotización en Clientes.
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {enCurso.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                En curso ({enCurso.length})
              </h2>
              <ProjectList projects={enCurso} />
            </section>
          )}
          {completados.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Completados ({completados.length})
              </h2>
              <ProjectList projects={completados} />
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function ProjectList({ projects }: { projects: Awaited<ReturnType<typeof listProjects>> }) {
  return (
    <div className="divide-y divide-border rounded-xl border border-border bg-card">
      {projects.map((p) => (
        <Link
          key={p.id}
          href={`/proyectos/${p.id}`}
          className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-muted/50 transition-colors"
        >
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{p.name}</p>
            <p className="truncate text-sm text-muted-foreground">{p.clientName}</p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-4">
            <div className="hidden sm:block w-32">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${p.progressPercent}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{p.progressPercent}%</p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_TINT[p.status] ?? "bg-muted text-muted-foreground"}`}
            >
              {p.status}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
