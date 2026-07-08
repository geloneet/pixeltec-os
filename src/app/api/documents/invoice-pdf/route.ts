import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { requireSession } from "@/lib/vpsClient";
import { findInvoiceByPublicId } from "@/lib/documents/pg";
import type { Invoice, InvoiceItem } from "@/types/documents";

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

    const pdf = await buildInvoicePdf(invoice);

    const safeName = invoice.number.replace(/[^a-zA-Z0-9_\-]/g, "_");
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[invoice-pdf]", err);
    return new NextResponse("Internal error", { status: 500 });
  }
}

async function buildInvoicePdf(invoice: Invoice): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  const margin = 60;

  // Header band
  page.drawRectangle({
    x: 0,
    y: height - 80,
    width,
    height: 80,
    color: rgb(0.05, 0.05, 0.1),
  });

  page.drawText("FACTURA", {
    x: margin,
    y: height - 50,
    size: 22,
    font: boldFont,
    color: rgb(0.2, 0.85, 0.8),
  });

  page.drawText(safe(invoice.number), {
    x: margin,
    y: height - 68,
    size: 11,
    font,
    color: rgb(0.6, 0.6, 0.65),
  });

  // Dates block (right-aligned)
  const dateLabel = (label: string, val: string) =>
    `${label}: ${new Date(val).toLocaleDateString("es-MX", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })}`;

  const issueLine = safe(dateLabel("Emitida", invoice.issueDate));
  const dueLine = safe(dateLabel("Vence", invoice.dueDate));
  const issueW = boldFont.widthOfTextAtSize(issueLine, 10);
  const dueW = boldFont.widthOfTextAtSize(dueLine, 10);

  page.drawText(issueLine, {
    x: width - margin - issueW,
    y: height - 45,
    size: 10,
    font: boldFont,
    color: rgb(0.8, 0.8, 0.8),
  });
  page.drawText(dueLine, {
    x: width - margin - dueW,
    y: height - 62,
    size: 10,
    font,
    color: rgb(0.7, 0.7, 0.7),
  });

  let y = height - 110;
  let currentPage = page;

  // Page-break helper: adds a new page when y is too close to the bottom
  const ensureSpace = (needed = 16) => {
    if (y < margin + needed) {
      currentPage = pdfDoc.addPage([595.28, 841.89]);
      y = currentPage.getSize().height - margin;
    }
  };

  // Column headers
  const cols = { desc: margin, qty: 300, price: 380, subtotal: 460 };
  const headerY = y;

  currentPage.drawRectangle({
    x: margin - 4,
    y: headerY - 4,
    width: width - margin * 2 + 8,
    height: 20,
    color: rgb(0.1, 0.1, 0.15),
  });

  currentPage.drawText("Descripción", { x: cols.desc, y: headerY, size: 9, font: boldFont, color: rgb(0.7, 0.7, 0.7) });
  currentPage.drawText("Cant.", { x: cols.qty, y: headerY, size: 9, font: boldFont, color: rgb(0.7, 0.7, 0.7) });
  currentPage.drawText("Precio unit.", { x: cols.price, y: headerY, size: 9, font: boldFont, color: rgb(0.7, 0.7, 0.7) });
  currentPage.drawText("Subtotal", { x: cols.subtotal, y: headerY, size: 9, font: boldFont, color: rgb(0.7, 0.7, 0.7) });

  y = headerY - 20;

  // Line items
  for (const item of invoice.items as InvoiceItem[]) {
    ensureSpace(16);
    const descLines = wrapText(safe(item.description), font, 9, cols.qty - cols.desc - 8);
    currentPage.drawText(descLines[0] ?? "", { x: cols.desc, y, size: 9, font, color: rgb(0.85, 0.85, 0.85) });
    currentPage.drawText(String(item.qty), { x: cols.qty, y, size: 9, font, color: rgb(0.85, 0.85, 0.85) });
    currentPage.drawText(formatMXN(item.unitPrice), { x: cols.price, y, size: 9, font, color: rgb(0.85, 0.85, 0.85) });
    currentPage.drawText(formatMXN(item.subtotal), { x: cols.subtotal, y, size: 9, font, color: rgb(0.85, 0.85, 0.85) });
    y -= 16;
    for (let li = 1; li < descLines.length; li++) {
      ensureSpace(14);
      currentPage.drawText(descLines[li], { x: cols.desc, y, size: 9, font, color: rgb(0.7, 0.7, 0.7) });
      y -= 14;
    }
  }

  // Divider
  ensureSpace(30);
  y -= 8;
  currentPage.drawLine({
    start: { x: cols.subtotal - 8, y },
    end: { x: width - margin, y },
    thickness: 0.5,
    color: rgb(0.4, 0.4, 0.4),
  });
  y -= 14;

  // Totals
  const totals: [string, number][] = [
    ["Subtotal", invoice.subtotal],
    [`IVA (${Math.round(invoice.ivaRate * 100)}%)`, invoice.ivaAmount],
  ];
  for (const [label, amount] of totals) {
    ensureSpace(14);
    currentPage.drawText(label, { x: cols.price, y, size: 9, font, color: rgb(0.65, 0.65, 0.65) });
    currentPage.drawText(formatMXN(amount), { x: cols.subtotal, y, size: 9, font, color: rgb(0.65, 0.65, 0.65) });
    y -= 14;
  }

  ensureSpace(24);
  const totalW = boldFont.widthOfTextAtSize(formatMXN(invoice.total), 12);
  currentPage.drawText("Total", { x: cols.price, y, size: 12, font: boldFont, color: rgb(0.9, 0.9, 0.9) });
  currentPage.drawText(formatMXN(invoice.total), {
    x: width - margin - totalW,
    y,
    size: 12,
    font: boldFont,
    color: rgb(0.2, 0.85, 0.8),
  });
  y -= 24;

  // Notes
  if (invoice.notes) {
    ensureSpace(30);
    currentPage.drawText("Notas:", { x: margin, y, size: 9, font: boldFont, color: rgb(0.6, 0.6, 0.6) });
    y -= 14;
    for (const line of wrapText(safe(invoice.notes), font, 9, width - margin * 2)) {
      ensureSpace(13);
      currentPage.drawText(line, { x: margin, y, size: 9, font, color: rgb(0.6, 0.6, 0.6) });
      y -= 13;
    }
  }

  return pdfDoc.save();
}

function safe(text: string): string {
  return text
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/–/g, "-")
    .replace(/—/g, "--")
    .replace(/…/g, "...")
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x00-\xFF]/g, "?");
}

function formatMXN(n: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
  }).format(n);
}

function wrapText(
  text: string,
  font: { widthOfTextAtSize(t: string, s: number): number },
  size: number,
  maxWidth: number,
): string[] {
  const result: string[] = [];
  for (const para of text.split("\n")) {
    if (!para.trim()) { result.push(""); continue; }
    const words = para.split(" ");
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
      } else {
        if (line) result.push(line);
        line = word;
      }
    }
    if (line) result.push(line);
  }
  return result;
}
