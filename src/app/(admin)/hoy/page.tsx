import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTodayData } from "./actions";
import { ActiveProjectsPanel } from "@/components/hoy/active-projects-panel";
import { RecentClientsPanel } from "@/components/hoy/recent-clients-panel";
import {
  getVisibleQuickActions,
  getVisibleStatCards,
  isInicioWidgetVisible,
} from "@/components/hoy/inicio-surface";
import { StatCard } from "@/components/ui/stat-card";
import { QuickActionCard } from "@/components/dashboard/quick-action-card";
import PageHeader from "@/components/dashboard/PageHeader";

export const metadata: Metadata = {
  title: "Inicio — PixelTEC OS",
};

/**
 * «Hoy» se muestra como «Inicio» (WO-2026-00088 §5, la ruta /hoy se
 * conserva). WO-2026-00132: vistazo puramente comercial — clientes,
 * cotizaciones y proyectos en curso. Nada de infraestructura, tamaño de
 * código ni métricas operativas internas.
 */
export default async function HoyPage() {
  const data = await getTodayData();
  if (!data) redirect("/login?redirect=/hoy");

  const { stats } = data;
  const quickActions = getVisibleQuickActions();
  const statCards = getVisibleStatCards();
  const showActiveProjects = isInicioWidgetVisible("recentProjects");
  const showRecentClients = isInicioWidgetVisible("recentClients");

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-8">
      <PageHeader title="Inicio" description="Vistazo comercial de PixelTEC" />

      {quickActions.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {quickActions.map((action, i) => (
            <QuickActionCard key={action.href} {...action} tint={i} />
          ))}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="flex flex-col gap-4 xl:col-span-2">
          {statCards.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {statCards.map((card) => (
                <StatCard key={card.key} icon={card.icon} label={card.label} value={card.format(stats)} />
              ))}
            </div>
          )}
          {showActiveProjects && <ActiveProjectsPanel projects={data.projects} />}
        </div>

        <div className="flex flex-col gap-4 xl:col-span-1">
          {showRecentClients && <RecentClientsPanel clients={data.clients} />}
        </div>
      </div>
    </div>
  );
}
