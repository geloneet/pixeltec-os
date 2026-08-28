// Server-only helpers que alimentan /hoy (Inicio). Fase 4: el núcleo CRM ya
// vive en Postgres (tabla `clients`, source='crm_blob') — se dejó de leer el
// blob `crm_data/{uid}` de Firestore.
//
// WO-2026-00132: se retiraron `deriveActiveProjects`/`deriveAllProjects` (las
// 3 fuentes viejas — CRM blob, Definición, PixelForge). Los proyectos de
// Inicio ahora salen de `@/lib/projects/queries` (tabla `projects` real).
import { getFullCrmData } from "@/lib/db/repos/crm-sync";
import type { CRMClient } from "@/types/crm";
import type { RecentClient } from "@/lib/hoy/types";

/**
 * Clientes del propietario indicado.
 *
 * `ownerId` es `users.id` — la identidad canónica, la misma que referencian por
 * clave foránea los `owner_id` de las tablas de negocio. Antes esta función
 * recibía el `firebaseUid` puente y lo traducía con una consulta a
 * `users.firebase_uid`; ese rodeo desaparece, porque el identificador que
 * necesita `getFullCrmData` es justo el que ya trae la sesión.
 *
 * El nombre lleva el tipo de identificador a propósito: el error que motivó
 * este cambio fue pasar un identificador de un espacio donde se esperaba otro,
 * y una firma `getCrmClients(uid)` no lo delataba.
 */
export async function getCrmClientsByOwnerId(ownerId: string): Promise<CRMClient[]> {
  const data = await getFullCrmData(ownerId);
  return data.clients;
}

/** Map clients to RecentClient rows, newest first. slug carries the id. Pass `limit` to cap. */
export function deriveRecentClients(
  clients: CRMClient[],
  limit?: number,
): RecentClient[] {
  const mapped = clients
    .map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.id,
      lastActivityAt: c.createdAt ?? null,
    }))
    .sort((a, b) =>
      (b.lastActivityAt ?? "").localeCompare(a.lastActivityAt ?? ""),
    );
  return typeof limit === "number" ? mapped.slice(0, limit) : mapped;
}

// WO-2026-00132: se retiró `deriveActivitySeries` (gráfica de sesiones de
// trabajo) — era una métrica operativa/interna, no comercial. Inicio ahora
// muestra clientes, proyectos y cotizaciones.
