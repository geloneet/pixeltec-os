import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guards";
import { addNote, listNotes } from "@/lib/db/repos/whatsapp-contacts";
import { parseJsonBody, toInboxFailure } from "@/lib/whatsapp-inbox/errors";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ phone: string }> }) {
  const guard = await requireAdmin(req.cookies.get("__session")?.value, {
    route: "/api/whatsapp-inbox/contacts/[phone]/notes",
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  try {
    const { phone } = await params;
    const notes = await listNotes(phone);
    return NextResponse.json({ notes });
  } catch (error) {
    // Un error de Drizzle puede citar SQL, nombres de columna y constraints.
    const failure = toInboxFailure(error, "No se pudieron obtener las notas.");
    return NextResponse.json({ error: failure.message, code: failure.code }, { status: failure.status });
  }
}

/**
 * POST: agrega una nota. Body `{ text }` — `createdBy` se deriva del guard
 * `requireAdmin`, no del cliente. Si el teléfono no tiene fila de contacto
 * todavía, el repo crea una fila mínima antes de insertar la nota (misma
 * capacidad que Firestore: notas bajo un doc de contacto nunca creado).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ phone: string }> }) {
  const guard = await requireAdmin(req.cookies.get("__session")?.value, {
    route: "/api/whatsapp-inbox/contacts/[phone]/notes",
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const parsed = await parseJsonBody<{ text?: string }>(req);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Cuerpo JSON inválido", code: "invalid_body" }, { status: 400 });
  }
  const text = parsed.value.text?.trim();
  if (!text) {
    return NextResponse.json({ error: "text es requerido" }, { status: 400 });
  }

  try {
    const { phone } = await params;
    const note = await addNote(phone, text, guard.uid);
    return NextResponse.json({ note });
  } catch (error) {
    const failure = toInboxFailure(error, "No se pudo guardar la nota.");
    return NextResponse.json({ error: failure.message, code: failure.code }, { status: failure.status });
  }
}
