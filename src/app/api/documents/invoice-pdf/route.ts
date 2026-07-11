import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession } from "@/lib/vpsClient";
import { findInvoiceByPublicId } from "@/lib/documents/pg";
import { resolveInvoiceClientName, generateInvoicePdf, safeInvoiceFilename } from "@/lib/documents/invoice-pdf-render";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const invoiceId = req.nextUrl.searchParams.get("invoiceId");
    if (!invoiceId) {
      return new NextResponse("Missing invoiceId", { status: 400 });
    }

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("__session")?.value ?? "";
    const session = await requireSession(sessionCookie);
    if (!session.ok) return new NextResponse("Unauthorized", { status: 401 });

    const invoice = await findInvoiceByPublicId(invoiceId);
    if (!invoice) return new NextResponse("Invoice not found", { status: 404 });
    if (invoice.uid !== session.uid) return new NextResponse("Forbidden", { status: 403 });

    const clientName = await resolveInvoiceClientName(invoice.clientId);
    const pdf = await generateInvoicePdf(invoice, clientName);

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeInvoiceFilename(invoice.number)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[invoice-pdf]", err);
    return new NextResponse("Internal error", { status: 500 });
  }
}
