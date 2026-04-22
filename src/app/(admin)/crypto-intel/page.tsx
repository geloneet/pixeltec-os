// src/app/(admin)/crypto-intel/page.tsx
// Dashboard del módulo. Fase 1: market pulse + alertas activas.
// Server Component que lee de Firestore. Auto-revalida cada 60s.

import { db, COL } from "@/lib/crypto-intel/firebase-admin";
import { WATCHLIST } from "@/lib/crypto-intel/watchlist";
import type { PriceSnapshot, AlertRule } from "@/lib/crypto-intel/types";
import { MarketPulseCard } from "@/components/crypto-intel/MarketPulseCard";
import { ActiveAlertsCard } from "@/components/crypto-intel/ActiveAlertsCard";
import { SystemStatusCard } from "@/components/crypto-intel/SystemStatusCard";

export const revalidate = 60;
export const dynamic = "force-dynamic";

async function loadPrices(): Promise<PriceSnapshot[]> {
  const symbols = WATCHLIST.map((w) => w.symbol);
  const docs = await Promise.all(
    symbols.map((s) => db().collection(COL.prices).doc(s).get())
  );
  return docs
    .filter((d) => d.exists)
    .map((d) => d.data() as PriceSnapshot);
}

async function loadActiveAlerts(): Promise<(AlertRule & { id: string })[]> {
  const snap = await db()
    .collection(COL.alertRules)
    .where("active", "==", true)
    .limit(20)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as AlertRule) }));
}

export default async function CryptoIntelDashboard() {
  const [prices, alerts] = await Promise.all([
    loadPrices(),
    loadActiveAlerts(),
  ]);

  const oldestPrice = prices.reduce<number | null>((min, p) => {
    const t = p.updatedAt.toMillis();
    return min === null || t < min ? t : min;
  }, null);

  return (
    <div className="space-y-8 text-white">
      <header>
        <h1 className="font-logo text-3xl font-bold tracking-tight">
          Crypto Intelligence
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Contexto de mercado para decisiones informadas · Auto-refresh 60s
        </p>
      </header>

      {/* Bento grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-6 md:grid-rows-[auto_auto_auto]">
        {/* Market Pulse - 4 columnas */}
        <div className="md:col-span-4 md:row-span-2">
          <MarketPulseCard prices={prices} />
        </div>

        {/* System Status - 2 columnas */}
        <div className="md:col-span-2">
          <SystemStatusCard
            assetsTracked={prices.length}
            oldestPriceTimestamp={oldestPrice}
            activeAlertsCount={alerts.length}
          />
        </div>

        {/* Placeholder: Fear & Greed (Fase 3) */}
        <div className="md:col-span-2">
          <PlaceholderCard
            title="Fear & Greed"
            subtitle="Sentimiento de mercado"
            comingIn="Fase 3"
          />
        </div>

        {/* Active Alerts - 3 columnas */}
        <div className="md:col-span-3">
          <ActiveAlertsCard alerts={alerts} />
        </div>

        {/* Placeholder: Último Briefing (Fase 3) */}
        <div className="md:col-span-3">
          <PlaceholderCard
            title="Último Briefing"
            subtitle="Análisis generado por IA"
            comingIn="Fase 3"
          />
        </div>
      </div>

      <p className="mx-auto max-w-2xl text-center text-xs leading-relaxed text-zinc-600">
        La información presentada en este módulo proviene de fuentes públicas
        (CoinGecko, Binance) y análisis automatizado. No constituye asesoría
        de inversión. Los criptoactivos son de alto riesgo y volatilidad.
        Las decisiones son responsabilidad exclusiva del usuario.
      </p>
    </div>
  );
}

function PlaceholderCard({
  title,
  subtitle,
  comingIn,
}: {
  title: string;
  subtitle: string;
  comingIn: string;
}) {
  return (
    <div className="relative h-full min-h-[180px] overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.03),transparent_60%)]" />
      <div className="relative flex h-full flex-col justify-between">
        <div>
          <h3 className="text-lg font-medium text-white/60">{title}</h3>
          <p className="text-sm text-white/30">{subtitle}</p>
        </div>
        <span className="inline-flex w-fit items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-white/40">
          {comingIn}
        </span>
      </div>
    </div>
  );
}
