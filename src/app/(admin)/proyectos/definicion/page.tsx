import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Sparkles, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { auth } from "@/lib/auth/config";
import { listDefinitionsByOwner } from "@/lib/db/repos/definitions";
import { DefinitionStatusBadge } from "@/components/definition/DefinitionStatusBadge";

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
          <h1 className="text-2xl font-semibold text-foreground">
            Definición de proyectos
          </h1>
          <p className="text-sm text-muted-foreground">
            Pipeline IA para aterrizar ideas en entregables sellados, cliente por cliente
          </p>
        </div>
      </header>

      {definitions.length === 0 ? (
        <div className="rounded-xl border border-border bg-card py-16 text-center">
          <Sparkles className="mx-auto mb-3 h-6 w-6 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">Aún no hay definiciones</p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            Empieza una desde la pestaña Proyectos de un cliente, con el botón
            &ldquo;Nuevo Proyecto&rdquo;.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {definitions.map((d) => {
            return (
              <Link
                key={d.id}
                href={`/proyectos/definicion/${d.id}`}
                className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5 transition-colors hover:border-cyan-400/30 hover:bg-secondary/40"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 flex-shrink-0 text-cyan-300" strokeWidth={1.75} />
                  <h2 className="truncate text-sm font-semibold text-foreground">
                    {d.title}
                  </h2>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {d.clientName ?? "Cliente"}
                </p>
                <div className="mt-1 flex items-center gap-1.5">
                  <DefinitionStatusBadge status={d.status} currentStation={d.currentStation} />
                  {d.proposalId && (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
                      <FileText className="h-3 w-3" />
                      Propuesta generada
                    </span>
                  )}
                </div>
                <p className="mt-auto pt-1 text-[11px] text-muted-foreground/60">
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
