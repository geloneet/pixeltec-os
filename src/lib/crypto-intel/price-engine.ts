// src/lib/crypto-intel/price-engine.ts
// Ingesta de precios vía CoinGecko (más simple para MVP; WS de Binance se agrega en Fase 2).
// Llamado desde el cron /api/crypto-intel/prices/sync cada minuto.

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db, COL } from "./firebase-admin";
import { WATCHLIST } from "./watchlist";
import type { PriceSnapshot } from "./types";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

interface CoinGeckoMarketData {
  id: string;
  symbol: string;
  current_price: number;
  price_change_percentage_1h_in_currency?: number;
  price_change_percentage_24h_in_currency?: number;
  price_change_percentage_7d_in_currency?: number;
  total_volume: number;
  market_cap: number;
}

/**
 * Fetch precios de CoinGecko para toda la watchlist.
 * Una sola llamada al endpoint /coins/markets para toda la lista (eficiente con free tier).
 */
async function fetchCoinGeckoPrices(): Promise<CoinGeckoMarketData[]> {
  const ids = WATCHLIST.map((w) => w.coingeckoId).join(",");
  const url =
    `${COINGECKO_BASE}/coins/markets` +
    `?vs_currency=usd&ids=${ids}` +
    `&order=market_cap_desc&per_page=50&page=1` +
    `&sparkline=false&price_change_percentage=1h,24h,7d`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    // Importante: Next.js fetch cachea por default. Desactivamos para datos live.
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(
      `CoinGecko API error: ${res.status} ${res.statusText}`
    );
  }

  return (await res.json()) as CoinGeckoMarketData[];
}

/**
 * Sincroniza precios: fetch + write a prices/{symbol} + append a priceSnapshots.
 * Retorna resumen de ejecución para logs.
 */
export async function syncPrices(): Promise<{
  synced: number;
  failed: string[];
  durationMs: number;
}> {
  const started = Date.now();
  const failed: string[] = [];

  let markets: CoinGeckoMarketData[];
  try {
    markets = await fetchCoinGeckoPrices();
  } catch (err) {
    console.error("[price-engine] fetch failed", err);
    throw err;
  }

  const firestore = db();
  const batch = firestore.batch();
  const now = Timestamp.now();
  let synced = 0;

  for (const entry of WATCHLIST) {
    const market = markets.find((m) => m.id === entry.coingeckoId);
    if (!market) {
      failed.push(entry.symbol);
      continue;
    }

    const snapshot: PriceSnapshot = {
      symbol: entry.symbol,
      priceUsd: market.current_price,
      change1h: market.price_change_percentage_1h_in_currency ?? 0,
      change24h: market.price_change_percentage_24h_in_currency ?? 0,
      change7d: market.price_change_percentage_7d_in_currency ?? 0,
      volume24h: market.total_volume,
      marketCap: market.market_cap,
      source: "coingecko",
      updatedAt: now,
    };

    // Doc "latest" sobre-escrito
    const priceRef = firestore.collection(COL.prices).doc(entry.symbol);
    batch.set(priceRef, snapshot);

    // Append a histórico (sub-colección points)
    const pointRef = firestore
      .collection(COL.priceSnapshots)
      .doc(entry.symbol)
      .collection("points")
      .doc();
    batch.set(pointRef, {
      symbol: entry.symbol,
      price: market.current_price,
      volume: market.total_volume,
      timestamp: now,
      interval: "1m",
    });

    synced++;
  }

  await batch.commit();

  return {
    synced,
    failed,
    durationMs: Date.now() - started,
  };
}

/**
 * Utilidad: obtener precio actual de un symbol. Usado por el bot para /precio.
 */
export async function getLatestPrice(
  symbol: string
): Promise<PriceSnapshot | null> {
  const snap = await db().collection(COL.prices).doc(symbol.toUpperCase()).get();
  if (!snap.exists) return null;
  return snap.data() as PriceSnapshot;
}
