import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Sparkles, CheckCircle2, FileEdit, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { auth } from "@/lib/auth/config";
import { listDefinitionsByOwner } from "@/lib/db/repos/definitions";
import { getStationMeta } from "@/lib/definition/station-meta";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Definición de proyectos — PixelTEC OS",
};

export default async function DefinicionListPage() {
  const session = await auth();
  const ownerId = session?.user?.id;
  if (!ownerId) redirect("/login?redirect=/proyectos/definicion");

  const definitions = await listDefinitionsByOwner(ownerId);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">
            Definición de proyectos
          </h1>
          <p className="text-sm text-zinc-500">
            Pipeline IA para aterrizar ideas en entregables sellados, cliente por cliente
          </p>
        </div>
      </header>

      {definitions.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 py-16 text-center">
          <Sparkles className="mx-auto mb-3 h-6 w-6 text-zinc-600" />
          <p className="text-sm text-zinc-400">Aún no hay definiciones</p>
          <p className="mt-1 text-xs text-zinc-600">
            Empieza una desde la pestaña Proyectos de un cliente, con el botón
            &ldquo;Nuevo Proyecto&rdquo;.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {definitions.map((d) => {
            const completed = d.status === "completed";
            const isDraft = d.status === "draft";
            const meta = getStationMeta(d.currentStation);
            return (
              <Link
                key={d.id}
                href={`/proyectos/definicion/${d.id}`}
                className="flex flex-col gap-2 rounded-xl border border-white/[0.06] bg-zinc-900/30 p-5 transition-colors hover:border-cyan-400/30 hover:bg-white/[0.04]"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 flex-shrink-0 text-cyan-300" strokeWidth={1.75} />
                  <h2 className="truncate text-sm font-semibold text-zinc-100">
                    {d.title}
                  </h2>
                </div>
                <p className="truncate text-xs text-zinc-500">
                  {d.clientName ?? "Cliente"}
                </p>
                <div className="mt-1 flex items-center gap-1.5">
                  {completed ? (
                    <span className="flex items-center gap-1 rounded bg-cyan-500/10 px-1.5 py-0.5 text-[11px] font-medium text-cyan-300">
                      <CheckCircle2 className="h-3 w-3" />
                      Completo
                    </span>
                  ) : isDraft ? (
                    <span className="flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-medium text-amber-300">
                      <FileEdit className="h-3 w-3" />
                      Borrador
                    </span>
                  ) : (
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[11px] font-medium",
                        "bg-zinc-800 text-zinc-400"
                      )}
                    >
                      {meta.stepLabel}
                    </span>
                  )}
                  {d.proposalId && (
                    <span className="flex items-center gap-1 text-[11px] text-zinc-600">
                      <FileText className="h-3 w-3" />
                      Propuesta generada
                    </span>
                  )}
                </div>
                <p className="mt-auto pt-1 text-[11px] text-zinc-600">
                  Actualizado{" "}
                  {formatDistanceToNow(new Date(d.updatedAt), {
                    addSuffix: true,
                    locale: es,
                  })}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
