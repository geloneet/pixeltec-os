"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import { useCRM } from "@/components/crm/CRMContext";
import { KpiCard } from "./KpiCard";

export function KpiClients() {
  const crm = useCRM();

  if (crm.loading) {
    return <KpiCard.Skeleton />;
  }

  const total = crm.clients.length;
  const activos = crm.clients.filter((c) => c.projects.length > 0).length;

  return (
    <Link href="/clientes" className="block focus:outline-none">
      <KpiCard
        icon={<Users className="w-5 h-5" />}
        iconColor="text-cyan-400"
        accentClass="shadow-cyan-500/10 group-hover:shadow-cyan-500/20"
        label="Clientes activos"
        value={activos.toString()}
        subtitle={`de ${total} totales`}
      />
    </Link>
  );
}
