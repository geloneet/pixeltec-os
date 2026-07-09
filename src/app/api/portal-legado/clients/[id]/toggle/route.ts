import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";

export const runtime = "nodejs";

/** POST: activa/desactiva el acceso al portal legado de un cliente. Body `{ enabled }`. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(req.cookies.get("__session")?.value, {
    route: "/api/portal-legado/clients/[id]/toggle",
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  try {
    const { id } = await params;
    const body = (await req.json()) as { enabled?: boolean };

    const [client] = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, id)).limit(1);
    if (!client) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }

    await db.update(clients).set({ legacyPortalEnabled: Boolean(body.enabled) }).where(eq(clients.id, id));

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Error al actualizar el portal: " + message }, { status: 500 });
  }
}
