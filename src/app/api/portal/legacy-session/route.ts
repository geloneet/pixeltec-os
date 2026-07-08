import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { readLegacyPortalSession } from "@/lib/portal/legacy-session";

export const runtime = "nodejs";

/** Estado de sesión del portal legado para el layout client-side (mismo shape que antes devolvía useFirebaseUser: null = no autenticado, objeto = autenticado). */
export async function GET() {
  const session = await readLegacyPortalSession();
  if (!session) return NextResponse.json({ user: null });

  const [client] = await db
    .select({ name: clients.name, email: clients.email })
    .from(clients)
    .where(eq(clients.id, session.clientId))
    .limit(1);

  if (!client) return NextResponse.json({ user: null });
  return NextResponse.json({ user: { displayName: client.name, email: client.email } });
}
