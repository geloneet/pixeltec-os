import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  FolderKanban,
  Users,
  ListChecks,
  Flame,
  Clock3,
  KeyRound,
  Receipt,
  Server,
} from "lucide-react";
import { getTodayData } from "./actions";
import { ActiveProjectsPanel } from "@/components/hoy/active-projects-panel";
import { RecentClientsPanel } from "@/components/hoy/recent-clients-panel";
import { ActivityChart } from "@/components/hoy/activity-chart";
import { StatCard } from "@/components/ui/stat-card";
import { QuickActionCard } from "@/components/dashboard/quick-action-card";
import PageHeader from "@/components/dashboard/PageHeader";

export const metadata: Metadata = {
  title: "Hoy — PixelTEC OS",
};

/** Accesos rápidos — rutas reales del catálogo de navegación (nav-config.ts). */
const QUICK_ACTIONS = [
  {
    icon: FolderKanban,
    title: "Proyectos",
    description: "Vista maestra de todos los proyectos",
    href: "/proyectos",
  },
  {
    icon: Users,
    title: "Clientes",
    description: "Workspace completo por cliente",
    href: "/clientes",
  },
  {
    icon: Receipt,
    title: "Cobros",
    description: "Cobros recurrentes y vencimientos",
    href: "/cobros",
  },
  {
    icon: Server,
    title: "Infraestructura",
    description: "Estado del VPS y deploys",
    href: "/vps",
  },
];

export default async function HoyPage() {
  const data = await getTodayData();
  if (!data) redirect("/login?redirect=/hoy");

  const { stats } = data;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-8">
      <PageHeader title="Hoy" description="Proyectos activos y actividad reciente de clientes" />

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {QUICK_ACTIONS.map((action, i) => (
          <QuickActionCard key={action.href} {...action} tint={i} />
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="flex flex-col gap-4 xl:col-span-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard icon={FolderKanban} label="Proyectos activos" value={String(stats.activeProjects)} />
            <StatCard icon={Users} label="Clientes" value={String(stats.clients)} />
            <StatCard icon={ListChecks} label="Tareas abiertas" value={String(stats.openTasks)} />
            <StatCard icon={Flame} label="Racha" value={`${stats.streak}d`} />
            <StatCard icon={Clock3} label="Sesiones" value={String(stats.sessions)} />
            <StatCard icon={KeyRound} label="Base de conocimiento" value={String(stats.tools)} />
          </div>
          <ActivityChart activity={data.activity} />
        </div>

        <div className="flex flex-col gap-4 xl:col-span-1">
          <ActiveProjectsPanel projects={data.projects} />
          <RecentClientsPanel clients={data.clients} />
        </div>
      </div>
    </div>
  );
}
