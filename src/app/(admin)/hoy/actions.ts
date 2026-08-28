"use server";

import { getSessionUserId } from "@/lib/auth/session";
import { getFullCrmData } from "@/lib/db/repos/crm-sync";
import { listProjects } from "@/lib/projects/queries";
import { listQuotesForOwner } from "@/lib/quotes/dashboard-queries";
import { deriveRecentClients } from "@/lib/hoy/crm-data";
import type { TodayData } from "@/lib/hoy/types";

const EXPIRING_SOON_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Arma el payload de Inicio para el usuario autenticado. WO-2026-00132:
 * vistazo puramente comercial — clientes, proyectos (tabla `projects` real,
 * no las 3 fuentes viejas) y cotizaciones (pendientes/próximas a vencer).
 * Cero métricas de infraestructura, sesiones de trabajo o "accesos".
 *
 * Devuelve null cuando no hay sesión: la página redirige a /login.
 */
export async function getTodayData(): Promise<TodayData | null> {
  const ownerId = await getSessionUserId();
  if (!ownerId) return null;

  const now = new Date();
  const [{ clients }, projects, quotes] = await Promise.all([
    getFullCrmData(ownerId),
    listProjects(),
    listQuotesForOwner(),
  ]);

  const pendingQuotes = quotes.filter((q) => q.status === "enviada" || q.status === "lista").length;
  const expiringQuotes = quotes.filter(
    (q) =>
      q.status === "enviada" &&
      q.validUntil &&
      new Date(q.validUntil).getTime() - now.getTime() <= EXPIRING_SOON_MS
  ).length;
  const activeProjects = projects.filter((p) => p.status !== "Completado").length;

  return {
    projects: projects.slice(0, 6),
    clients: deriveRecentClients(clients, 5),
    stats: {
      activeProjects,
      clients: clients.length,
      pendingQuotes,
      expiringQuotes,
    },
    asOf: now.toISOString(),
  };
}
