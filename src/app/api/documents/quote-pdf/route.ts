import { NextResponse } from "next/server";
import { requireUserSession } from "@/lib/auth/session";
import { getQuoteById, getQuoteClient } from "@/lib/quotes/queries";
import { renderQuotePdf } from "@/lib/quotes/pdf";

/**
 * PDF de una cotización (WO-2026-00102). Exige sesión: este endpoint sirve al
 * panel. El cliente final llega por el enlace público `/c/[token]`, que tiene
 * su propia descarga y no pasa por aquí.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const session = await requireUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta el id" }, { status: 400 });

  const quote = await getQuoteById(id);
  if (!quote) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  const client = await getQuoteClient(quote.clientId);

  try {
    const pdf = await renderQuotePdf({ quote, clientName: client?.name ?? "" });
    return new Response(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="${quote.folio}.pdf"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    console.error("[quote-pdf] render failed:", error);
    return NextResponse.json({ error: "No se pudo generar el PDF" }, { status: 500 });
  }
}
