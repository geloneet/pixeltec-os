"use client";

import Link from "next/link";
import { Rocket } from "lucide-react";
import { useCRM } from "@/components/crm/CRMContext";
import { KpiCard } from "./KpiCard";

export function KpiProjects() {
  const crm = useCRM();

  if (crm.loading) {
    return <KpiCard.Skeleton />;
  }

  let total = 0;
  let enCurso = 0;
  for (const c of crm.clients) {
    for (const p of c.projects) {
      total++;
      if (p.tasks.some((t) => t.status !== "completado")) enCurso++;
    }
  }

  return (
    <Link href="/clientes" className="block focus:outline-none">
      <KpiCard
        icon={<Rocket className="w-5 h-5" />}
        iconColor="text-blue-400"
        accentClass="shadow-blue-500/10 group-hover:shadow-blue-500/20"
        label="Proyectos en curso"
        value={enCurso.toString()}
        subtitle={`de ${total} proyectos`}
      />
    </Link>
  );
}
