import { requireAdmin } from "@/lib/crypto-intel/auth";
import { listAuthorizedUsers } from "@/lib/crypto-intel/queries/users";
import { listLogs, getMetrics } from "@/lib/crypto-intel/queries/logs";
import { getLatestPrice, listActiveAlertRules } from "@/lib/db/repos/crypto-intel";
import { WATCHLIST } from "@/lib/crypto-intel/watchlist";
import { UsersTile } from "@/components/crypto-intel/admin/users-tile";
import { LogsTile } from "@/components/crypto-intel/admin/logs-tile";
import { MetricsTile } from "@/components/crypto-intel/admin/metrics-tile";
import { QuickActionsTile } from "@/components/crypto-intel/admin/quick-actions-tile";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin();

  const [users, logs, metrics, priceRows] = await Promise.all([
    listAuthorizedUsers(),
    listLogs({ limit: 50 }),
    getMetrics(),
    Promise.all(WATCHLIST.map((w) => getLatestPrice(w.symbol))),
  ]);

  const prices = priceRows.filter((r): r is NonNullable<typeof r> => r !== null);

  const oldestPriceMs = prices.reduce<number>((min, p) => {
    const t = p.updatedAt.getTime();
    return t < min ? t : min;
  }, Infinity);

  // Count active alert rules (ya excluye soft-deleted — active=false al borrar)
  const activeAlertRules = await listActiveAlertRules();

  return (
    <div className="space-y-8 text-white">
      <header>
        <h1 className="font-logo text-3xl font-bold tracking-tight">Panel Admin</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Crypto Intelligence · control operativo
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <UsersTile users={users} />
        <MetricsTile
          metrics={metrics}
          oldestPriceMs={oldestPriceMs === Infinity ? null : oldestPriceMs}
          activeAlertCount={activeAlertRules.length}
        />
        <LogsTile logs={logs} />
        <QuickActionsTile />
      </div>
    </div>
  );
}
