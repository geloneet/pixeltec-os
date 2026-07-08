import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";

export const runtime = "nodejs";

const MIN_LENGTH = 8;

/** POST: fija/reinicia la contraseña del portal legado de un cliente. Body `{ newPassword }`. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(req.cookies.get("__session")?.value, {
    route: "/api/portal-legado/clients/[id]/password",
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  try {
    const { id } = await params;
    const body = (await req.json()) as { newPassword?: string };
    const newPassword = body.newPassword ?? "";
    if (newPassword.length < MIN_LENGTH) {
      return NextResponse.json({ error: `La contraseña debe tener al menos ${MIN_LENGTH} caracteres` }, { status: 400 });
    }

    const [client] = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, id)).limit(1);
    if (!client) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await db.update(clients).set({ legacyPasswordHash: passwordHash }).where(eq(clients.id, id));

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Error al guardar la contraseña: " + message }, { status: 500 });
  }
}
