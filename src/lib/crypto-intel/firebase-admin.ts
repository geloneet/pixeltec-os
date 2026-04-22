// Bridge: re-exporta el Admin SDK existente de PixelTEC OS
// adaptado al API que el módulo crypto espera (db() y COL).

import { getAdminApp } from "@/lib/firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";

export function db(): Firestore {
  return getFirestore(getAdminApp());
}

export const COL = {
  assets: "assets",
  prices: "prices",
  priceSnapshots: "priceSnapshots",
  alertRules: "alertRules",
  alerts: "alerts",
  telegramUsers: "telegramUsers",
  telegramSessions: "telegramSessions",
  news: "news",
  briefings: "briefings",
  indicators: "indicators",
  cryptoIntelLogs: "cryptoIntelLogs",
} as const;
