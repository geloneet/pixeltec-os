import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import { findInvoiceByPublicId } from "@/lib/documents/pg";
import { buildInvoicePdf, safeInvoiceFilename } from "@/lib/documents/invoice-pdf-render";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const invoiceId = req.nextUrl.searchParams.get("invoiceId");
    if (!invoiceId) {
      return new NextResponse("Missing invoiceId", { status: 400 });
    }

    const userId = await getSessionUserId();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const invoice = await findInvoiceByPublicId(invoiceId);
    if (!invoice) return new NextResponse("Invoice not found", { status: 404 });
    if (invoice.uid !== userId) return new NextResponse("Forbidden", { status: 403 });

    const pdf = await buildInvoicePdf(invoice);

    return new NextResponse(Buffer.from(pdf), {
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
