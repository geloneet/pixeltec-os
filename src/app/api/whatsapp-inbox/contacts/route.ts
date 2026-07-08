import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guards";
import { listContacts, upsertContact, type ContactPatch } from "@/lib/db/repos/whatsapp-contacts";

export const runtime = "nodejs";

/** GET: lista todos los contactos (para el mapa contactsByPhone del inbox). */
export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req.cookies.get("__session")?.value, {
    route: "/api/whatsapp-inbox/contacts",
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  try {
    const contacts = await listContacts();
    return NextResponse.json({ contacts });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Error al obtener contactos: " + message }, { status: 500 });
  }
}

interface UpsertContactBody {
  phone?: string;
  patch?: ContactPatch;
  action?: string;
}

/**
 * POST: upsert de un contacto (crea la fila si no existe, merge parcial si
 * existe). Body: `{ phone, patch?, action? }` — `byUid` (para actionHistory)
 * NUNCA viaja en el body: se deriva del guard `requireAdmin` (misma
 * identidad — Firebase UID puente — que antes se leía de `useUser().uid`
 * client-side, ver src/lib/auth-guards.ts).
 */
export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req.cookies.get("__session")?.value, {
    route: "/api/whatsapp-inbox/contacts",
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  try {
    const body = (await req.json()) as UpsertContactBody;
    if (!body.phone) {
      return NextResponse.json({ error: "phone es requerido" }, { status: 400 });
    }
    const contact = await upsertContact(body.phone, body.patch ?? {}, guard.uid, body.action);
    return NextResponse.json({ contact });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Error al guardar el contacto: " + message }, { status: 500 });
  }
}
