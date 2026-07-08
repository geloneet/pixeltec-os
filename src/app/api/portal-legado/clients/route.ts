import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";

export const runtime = "nodejs";

/** Lista de clientes del portal legado (source='portal') para la UI de administración de contraseñas. Nunca devuelve el hash, solo si ya tiene una fijada. */
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
    .select({ id: clients.id, name: clients.name, email: clients.email, passwordHash: clients.legacyPasswordHash })
    .from(clients)
    .where(eq(clients.source, "portal"))
    .orderBy(clients.name);

  const result = rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    hasPassword: Boolean(r.passwordHash),
  }));

  return NextResponse.json({ clients: result });
}
