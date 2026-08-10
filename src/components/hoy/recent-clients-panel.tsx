import Link from "next/link";
import { Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { PanelCard } from "@/components/ui/panel-card";
import type { RecentClient } from "@/lib/hoy/types";

export function RecentClientsPanel({ clients }: { clients: RecentClient[] }) {
  return (
    <PanelCard icon={Users} title="Clientes recientes">
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
    </PanelCard>
  );
}
