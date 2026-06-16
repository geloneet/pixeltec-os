import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTodayData } from "./actions";
import { TodayTasksPanel } from "@/components/hoy/today-tasks-panel";
import { ActiveProjectsPanel } from "@/components/hoy/active-projects-panel";
import { RecentClientsPanel } from "@/components/hoy/recent-clients-panel";

export const metadata: Metadata = {
  title: "Hoy — PixelTEC OS",
};

export default async function HoyPage() {
  const data = await getTodayData();
  if (!data) redirect("/login?redirect=/hoy");

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-100">Hoy</h1>
        <p className="text-sm text-zinc-500">
          Tareas del día, proyectos activos y actividad reciente de clientes
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <TodayTasksPanel tasks={data.tasks} />
        </div>
        <ActiveProjectsPanel projects={data.projects} />
        <RecentClientsPanel clients={data.clients} />
      </div>
    </div>
  );
}
