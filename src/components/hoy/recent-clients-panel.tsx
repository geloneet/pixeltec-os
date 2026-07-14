import Link from "next/link";
import { Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import type { RecentClient } from "@/lib/hoy/types";

export function RecentClientsPanel({ clients }: { clients: RecentClient[] }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <header className="mb-4 flex items-center gap-2">
        <Users className="h-4 w-4 text-cyan-300" strokeWidth={1.75} />
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Clientes recientes
        </h2>
      </header>

      {clients.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Aún no hay clientes registrados.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {clients.map((client) => (
            <li key={client.id}>
              <Link
                href={`/clientes/${client.id}`}
                className="flex items-center gap-3 rounded-lg border border-transparent bg-transparent px-3 py-2.5 transition-colors hover:border-cyan-400/30 hover:bg-secondary/60"
              >
                <span className="truncate text-sm font-medium text-foreground">
                  {client.name}
                </span>
                {client.lastActivityAt && (
                  <span className="ml-auto flex-shrink-0 text-[11px] text-muted-foreground/70">
                    {formatDistanceToNow(new Date(client.lastActivityAt), {
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
