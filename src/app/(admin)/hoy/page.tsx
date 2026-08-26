import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTodayData } from "./actions";
import { ActiveProjectsPanel } from "@/components/hoy/active-projects-panel";
import { RecentClientsPanel } from "@/components/hoy/recent-clients-panel";
import { ActivityChart } from "@/components/hoy/activity-chart";
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
 * «Hoy» se muestra como «Inicio» (WO-2026-00088 §5): la ruta /hoy se conserva
 * y el contenido no se rediseña; solo se retiran las tarjetas, accesos y
 * widgets de módulos ocultos, que se declaran por módulo en
 * `components/hoy/inicio-surface.ts` y se filtran con el registro central.
 */
export default async function HoyPage() {
  const data = await getTodayData();
  if (!data) redirect("/login?redirect=/hoy");

  const { stats } = data;
  const quickActions = getVisibleQuickActions();
  const statCards = getVisibleStatCards();
  const showActivityChart = isInicioWidgetVisible("activityChart");
  const showActiveProjects = isInicioWidgetVisible("activeProjects");
  const showRecentClients = isInicioWidgetVisible("recentClients");

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-8">
      <PageHeader title="Inicio" description="Actividad reciente de clientes" />

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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {statCards.map((card) => (
                <StatCard key={card.key} icon={card.icon} label={card.label} value={card.format(stats)} />
              ))}
            </div>
          )}
          {showActivityChart && <ActivityChart activity={data.activity} />}
        </div>

        <div className="flex flex-col gap-4 xl:col-span-1">
          {showActiveProjects && <ActiveProjectsPanel projects={data.projects} />}
          {showRecentClients && <RecentClientsPanel clients={data.clients} />}
        </div>
      </div>
    </div>
  );
}
