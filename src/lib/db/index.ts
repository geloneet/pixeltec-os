/**
 * Cliente Drizzle (Postgres) — nuevo stack destino (ver
 * docs/superpowers/plans/2026-07-07-firebase-to-postgres-drizzle-nextauth-migration.md).
 *
 * Patrón idéntico a `dalk/src/lib/db/index.ts`: singleton en `globalThis`
 * para no agotar el pool de conexiones con los recargas de HMR en dev.
 *
 * NOTA: este módulo todavía no está conectado a ninguna ruta/página real —
 * es parte de la Fase 0+1 de la migración (fundaciones + schema), construida
 * en paralelo sin tocar el código que hoy sirve tráfico (Firebase/Firestore).
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var _pgClient: postgres.Sql | undefined;
}

const client =
  globalThis._pgClient ?? postgres(process.env.DATABASE_URL!, { max: 10 });

if (process.env.NODE_ENV !== "production") {
  globalThis._pgClient = client;
}

export const db = drizzle(client, { schema });
export type DB = typeof db;
