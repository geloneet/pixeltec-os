"use client";

import {
  Calendar,
  DollarSign,
  Rocket,
  Server,
  Users,
  Wrench,
} from "lucide-react";
import { KpiClients } from "./components/KpiClients";
import { KpiProjects } from "./components/KpiProjects";
import { KpiTasks } from "./components/KpiTasks";
import { KpiVps } from "./components/KpiVps";
import { ModuleCard } from "./components/ModuleCard";

const MODULE_CARDS = [
  {
    title: "Hoy",
    description: "Tareas pendientes, pomodoro y agenda del día",
    href: "/hoy",
    icon: Calendar,
    accent: "cyan" as const,
  },
  {
    title: "Clientes",
    description: "Gestión de clientes y pipeline comercial",
    href: "/clientes",
    icon: Users,
    accent: "blue" as const,
  },
  {
    title: "Proyectos",
    description: "Kanban de proyectos activos por cliente",
    href: "/clientes",
    icon: Rocket,
    accent: "indigo" as const,
  },
  {
    title: "Herramientas",
    description: "Credenciales, prompts y documentación interna",
    href: "/herramientas",
    icon: Wrench,
    accent: "violet" as const,
  },
  {
    title: "DevOps",
    description: "Infraestructura VPS, deploys y monitoreo",
    href: "/vps",
    icon: Server,
    accent: "emerald" as const,
  },
  {
    title: "Cobros",
    description: "Facturas pendientes, pagos y revenue",
    href: "/clientes",
    icon: DollarSign,
    accent: "amber" as const,
    badge: "Pronto integrado",
  },
];

function formatToday(): string {
  return new Date().toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function DashboardPage() {
  return (
    <div className="space-y-10 pb-6">
      <header>
        <h1 className="font-headline text-3xl font-bold tracking-tight text-zinc-100">
          Dashboard
        </h1>
        <p className="mt-1 font-roboto text-sm text-zinc-400 capitalize">
          Centro de control de PixelTEC OS · {formatToday()}
        </p>
      </header>

      <section>
        <h2 className="font-headline text-xs font-semibold text-zinc-500 uppercase tracking-[0.15em] mb-4">
          Métricas en tiempo real
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiClients />
          <KpiProjects />
          <KpiTasks />
          <KpiVps />
        </div>
      </section>

      <section>
        <h2 className="font-headline text-xs font-semibold text-zinc-500 uppercase tracking-[0.15em] mb-4">
          Módulos
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {MODULE_CARDS.map((mod) => (
            <ModuleCard key={mod.title} {...mod} />
          ))}
        </div>
      </section>
    </div>
  );
}
