// src/lib/crypto-intel/types.ts
// Tipos centralizados del módulo. Importar desde aquí siempre para mantener consistencia.

import type { Timestamp } from "firebase-admin/firestore";

export type AssetSymbol = string; // "BTC", "ETH", etc.

export interface Asset {
  symbol: AssetSymbol;
  name: string;
  coingeckoId: string;
  binanceSymbol: string; // "BTCUSDT"
  rank: number;
  active: boolean;
  addedAt: Timestamp;
}

export interface PriceSnapshot {
  symbol: AssetSymbol;
  priceUsd: number;
  change1h: number;
  change24h: number;
  change7d: number;
  volume24h: number;
  marketCap: number;
  source: "binance" | "coingecko";
  updatedAt: Timestamp;
}

export interface PricePoint {
  symbol: AssetSymbol;
  price: number;
  volume: number;
  timestamp: Timestamp;
  interval: "1m" | "1h" | "1d";
}

// --- Alertas ---

export type AlertType =
  | "price_below"
  | "price_above"
  | "change_percent"
  | "rsi_extreme"
  | "ma_cross"
  | "volume_spike";

export interface AlertRule {
  id?: string;
  userId: string;
  symbol: AssetSymbol;
  type: AlertType;
  params: {
    threshold?: number;
    window?: "1h" | "24h" | "7d";
    direction?: "up" | "down";
  };
  channels: Array<"telegram" | "dashboard">;
  cooldownMinutes: number;
  active: boolean;
  lastTriggeredAt?: Timestamp;
  createdAt: Timestamp;
  // Phase 3A additions (backward-compat: all optional)
  telegramChatId?: string;
  displayName?: string;
  triggerCount?: number;
  updatedAt?: Timestamp;
  deletedAt?: Timestamp | null;
}

export interface AlertEvent {
  id?: string;
  ruleId: string;
  userId: string;
  symbol: AssetSymbol;
  message: string;
  payload: Record<string, unknown>;
  deliveredTo: string[];
  createdAt: Timestamp;
}

// --- Usuario del bot ---

export interface TelegramUser {
  telegramUserId: number;
  telegramUsername?: string;
  firstName?: string;
  timezone: string; // IANA, default "America/Mexico_City"
  role: "owner" | "operator";
  authorized: boolean;
  createdAt: Timestamp;
}

// --- Respuesta tipada de Binance !ticker@arr ---
export interface BinanceTickerMessage {
  s: string; // symbol (BTCUSDT)
  c: string; // last price
  P: string; // price change percent 24h
  v: string; // base asset volume
  q: string; // quote asset volume
  h: string; // high 24h
  l: string; // low 24h
}
