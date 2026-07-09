import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";

export const runtime = "nodejs";

/** GET: estado del portal legado de un cliente (nunca devuelve el hash). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(req.cookies.get("__session")?.value, {
    route: "/api/portal-legado/clients/[id]",
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { id } = await params;
  const [client] = await db
    .select({
      email: clients.email,
      source: clients.source,
      passwordHash: clients.legacyPasswordHash,
      enabled: clients.legacyPortalEnabled,
    })
    .from(clients)
    .where(eq(clients.id, id))
    .limit(1);

  if (!client) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    email: client.email,
    source: client.source,
    hasPassword: Boolean(client.passwordHash),
    enabled: client.enabled,
  });
}
