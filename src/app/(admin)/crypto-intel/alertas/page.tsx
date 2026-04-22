import { listAlerts } from "@/lib/crypto-intel/queries/alerts";
import { AlertsTable } from "@/components/crypto-intel/alerts/alerts-table";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AlertasPage() {
  const alerts = await listAlerts();
  const activeCount = alerts.filter((a) => a.active).length;
  const pausedCount = alerts.filter((a) => !a.active).length;

  return (
    <div className="space-y-8 text-white">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-logo text-3xl font-bold tracking-tight">Alertas</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {activeCount} activas · {pausedCount} pausadas
          </p>
        </div>
        <Button asChild className="bg-emerald-600 hover:bg-emerald-500">
          <Link href="/crypto-intel/alertas/nueva">
            <Plus className="mr-2 h-4 w-4" />
            Nueva alerta
          </Link>
        </Button>
      </div>
      <AlertsTable initialAlerts={alerts} />
    </div>
  );
}
