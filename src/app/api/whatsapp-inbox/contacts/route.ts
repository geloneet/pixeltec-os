import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guards";
import { listContacts, upsertContact, type ContactPatch } from "@/lib/db/repos/whatsapp-contacts";
import { parseJsonBody, toInboxFailure } from "@/lib/whatsapp-inbox/errors";

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
    // Un error de Drizzle puede citar SQL, nombres de columna y constraints.
    const failure = toInboxFailure(error, "No se pudieron obtener los contactos.");
    return NextResponse.json({ error: failure.message, code: failure.code }, { status: failure.status });
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

  const parsed = await parseJsonBody<UpsertContactBody>(req);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Cuerpo JSON inválido", code: "invalid_body" }, { status: 400 });
  }
  const body = parsed.value;
  if (!body.phone) {
    return NextResponse.json({ error: "phone es requerido" }, { status: 400 });
  }

  try {
    const contact = await upsertContact(body.phone, body.patch ?? {}, guard.uid, body.action);
    return NextResponse.json({ contact });
  } catch (error) {
    const failure = toInboxFailure(error, "No se pudo guardar el contacto.");
    return NextResponse.json({ error: failure.message, code: failure.code }, { status: failure.status });
  }
}
