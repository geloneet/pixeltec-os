import Link from "next/link";
import { Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import type { RecentClient } from "@/lib/hoy/types";

export function RecentClientsPanel({ clients }: { clients: RecentClient[] }) {
  return (
    <section className="rounded-xl border border-white/[0.06] bg-zinc-900/30 p-5">
      <header className="mb-4 flex items-center gap-2">
        <Users className="h-4 w-4 text-cyan-300" strokeWidth={1.75} />
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-300">
          Clientes recientes
        </h2>
      </header>

      {clients.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-500">
          Aún no hay clientes registrados.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {clients.map((client) => (
            <li key={client.id}>
              <Link
                href={`/clientes/${client.id}`}
                className="flex items-center gap-3 rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2.5 transition-colors hover:border-cyan-400/30 hover:bg-white/[0.04]"
              >
                <span className="truncate text-sm font-medium text-zinc-100">
                  {client.name}
                </span>
                {client.lastActivityAt && (
                  <span className="ml-auto flex-shrink-0 text-[11px] text-zinc-600">
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
