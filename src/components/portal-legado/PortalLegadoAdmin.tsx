"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

interface LegacyClient {
  id: string;
  name: string;
  email: string | null;
  source: "crm_blob" | "portal";
  mechanism: "password" | "token";
  hasPortal: boolean;
  enabled: boolean;
}

const MECHANISM_LABEL: Record<LegacyClient["mechanism"], string> = {
  password: "Correo + contraseña",
  token: "Link con token",
};

// Vista de solo lectura — las acciones (fijar contraseña, activar,
// rotar/revocar token) viven en la ficha de cada cliente (tab "Portal").
export function PortalLegadoAdmin() {
  const [clients, setClients] = useState<LegacyClient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/portal-legado/clients")
      .then((res) => res.json())
      .then((data) => setClients(data.clients ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="md" className="text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.03] divide-y divide-white/5">
      {clients.map((client) => (
        <Link
          key={client.id}
          href={`/clientes/${client.id}`}
          className="flex items-center justify-between gap-4 p-4 hover:bg-white/[0.03] transition-colors"
        >
          <div>
            <p className="font-medium text-zinc-200">{client.name}</p>
            <p className="text-sm text-zinc-500">{client.email ?? "sin correo"}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-600">{MECHANISM_LABEL[client.mechanism]}</span>
            {!client.hasPortal ? (
              <span className="text-xs text-zinc-500">Sin portal</span>
            ) : (
              <span className={`text-xs ${client.enabled ? "text-emerald-400" : "text-zinc-500"}`}>
                {client.enabled ? "Activo" : "Inactivo"}
              </span>
            )}
            <ArrowRight className="h-3.5 w-3.5 text-zinc-600" />
          </div>
        </Link>
      ))}
      {clients.length === 0 && <p className="p-6 text-center text-sm text-zinc-500">No hay clientes.</p>}
    </div>
  );
}
