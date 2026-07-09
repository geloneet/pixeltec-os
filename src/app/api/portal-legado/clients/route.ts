import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";

export const runtime = "nodejs";

/**
 * Vista general (solo lectura) de estado de portal por cliente — restaurada
 * tras el code review del 2026-07-09: sin esto no había forma de ver de un
 * vistazo qué clientes tienen portal activo/inactivo. Cubre AMBOS
 * mecanismos (ver PortalTab.tsx): password (source='portal') y token
 * (source='crm_blob'). Las acciones (fijar contraseña, rotar/revocar token)
 * viven en la ficha de cada cliente — esta vista no las duplica.
 */
export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req.cookies.get("__session")?.value, {
    route: "/api/portal-legado/clients",
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const rows = await db
    .select({
      id: clients.id,
      name: clients.name,
      email: clients.email,
      source: clients.source,
      passwordHash: clients.legacyPasswordHash,
      passwordEnabled: clients.legacyPortalEnabled,
      portalToken: clients.portalToken,
      tokenEnabled: clients.portalEnabled,
    })
    .from(clients)
    .orderBy(clients.name);

  const result = rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    source: r.source,
    mechanism: r.source === "portal" ? "password" : "token",
    hasPortal: r.source === "portal" ? Boolean(r.passwordHash) : Boolean(r.portalToken),
    enabled: r.source === "portal" ? r.passwordEnabled : r.tokenEnabled,
  }));

  return NextResponse.json({ clients: result });
}
