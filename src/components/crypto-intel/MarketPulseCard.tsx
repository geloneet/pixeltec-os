// src/components/crypto-intel/MarketPulseCard.tsx

import type { PriceSnapshot } from "@/lib/crypto-intel/types";

interface Props {
  prices: PriceSnapshot[];
}

export function MarketPulseCard({ prices }: Props) {
  const sorted = [...prices].sort((a, b) => b.marketCap - a.marketCap);

  return (
    <div className="relative h-full overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-6 backdrop-blur-sm">
      {/* Decorative gradient */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#00ffa3]/5 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-[#ff4560]/5 blur-3xl" />

      <div className="relative">
        <div className="mb-6 flex items-baseline justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
              Market Pulse
            </p>
            <h2 className="mt-1 text-xl font-semibold">Watchlist</h2>
          </div>
          <p className="font-mono text-xs text-white/40">
            {prices.length} assets
          </p>
        </div>

        <div className="space-y-1">
          {sorted.map((p) => (
            <PriceRow key={p.symbol} price={p} />
          ))}
        </div>
      </div>
    </div>
  );
}

function PriceRow({ price }: { price: PriceSnapshot }) {
  const isUp = price.change24h >= 0;
  const pct = `${isUp ? "+" : ""}${price.change24h.toFixed(2)}%`;

  return (
    <div className="group grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 rounded-xl px-3 py-3 transition-colors hover:bg-white/[0.03]">
      {/* Symbol badge */}
      <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 font-mono text-[11px] font-semibold text-white/80">
        {price.symbol}
      </div>

      {/* Price */}
      <div>
        <div className="font-mono text-sm font-medium tabular-nums text-white">
          ${formatPrice(price.priceUsd)}
        </div>
        <div className="mt-0.5 font-mono text-[10px] text-white/30">
          Vol ${(price.volume24h / 1e9).toFixed(2)}B
        </div>
      </div>

      {/* 1h */}
      <div className="hidden text-right md:block">
        <div className="font-mono text-[10px] uppercase tracking-wider text-white/30">
          1h
        </div>
        <ChangePill value={price.change1h} size="sm" />
      </div>

      {/* 24h */}
      <div className="text-right">
        <div className="font-mono text-[10px] uppercase tracking-wider text-white/30">
          24h
        </div>
        <ChangePill value={price.change24h} size="md" />
      </div>
    </div>
  );
}

function ChangePill({
  value,
  size,
}: {
  value: number;
  size: "sm" | "md";
}) {
  const isUp = value >= 0;
  const color = isUp ? "text-[#00ffa3]" : "text-[#ff4560]";
  const sizeCls = size === "md" ? "text-sm" : "text-xs";
  return (
    <div className={`font-mono ${sizeCls} font-medium tabular-nums ${color}`}>
      {isUp ? "+" : ""}
      {value.toFixed(2)}%
    </div>
  );
}

function formatPrice(n: number): string {
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(4);
}
