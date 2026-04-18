"use client";

import Link from "next/link";
import { CheckSquare } from "lucide-react";
import { useCRM } from "@/components/crm/CRMContext";
import { KpiCard } from "./KpiCard";

export function KpiTasks() {
  const crm = useCRM();

  if (crm.loading) {
    return <KpiCard.Skeleton />;
  }

  let pendientes = 0;
  let detenidas = 0;
  for (const c of crm.clients) {
    for (const p of c.projects) {
      for (const t of p.tasks) {
        if (t.status === "completado") continue;
        pendientes++;
        if (t.status === "detenido") detenidas++;
      }
    }
  }

  const subtitle =
    detenidas > 0
      ? `${detenidas} detenida${detenidas > 1 ? "s" : ""} · ${pendientes - detenidas} en flujo`
      : "por completar";

  return (
    <Link href="/hoy" className="block focus:outline-none">
      <KpiCard
        icon={<CheckSquare className="w-5 h-5" />}
        iconColor="text-violet-400"
        accentClass="shadow-violet-500/10 group-hover:shadow-violet-500/20"
        label="Tareas pendientes"
        value={pendientes.toString()}
        subtitle={subtitle}
      />
    </Link>
  );
}
