import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { getProposalByToken } from "@/lib/documents/proposals-admin";
import { cookies } from "next/headers";
import { requireSession } from "@/lib/vpsClient";
import { findProposalByPublicId } from "@/lib/documents/pg";
import type { Proposal } from "@/types/documents";

// Colors
const NAVY   = rgb(0.05, 0.08, 0.20);
const BLUE   = rgb(0.08, 0.42, 0.88);
const DARK   = rgb(0.10, 0.11, 0.15);
const GRAY   = rgb(0.42, 0.43, 0.47);
const LGRAY  = rgb(0.93, 0.93, 0.95);
const WHITE  = rgb(1, 1, 1);

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    let proposal: (Proposal & { id: string }) | null = null;

    const token = req.nextUrl.searchParams.get("token");
    const proposalId = req.nextUrl.searchParams.get("proposalId");

    if (token) {
      proposal = await getProposalByToken(token);
    } else if (proposalId) {
      // Admin-only by session
      const cookieStore = await cookies();
      const sessionCookie = cookieStore.get("__session")?.value ?? "";
      const session = await requireSession(sessionCookie);
      if (!session.ok) return new NextResponse("Unauthorized", { status: 401 });

      const found = await findProposalByPublicId(proposalId);
      if (!found) return new NextResponse("Not found", { status: 404 });
      if (found.uid !== session.uid) return new NextResponse("Forbidden", { status: 403 });
      proposal = found;
    }

    if (!proposal) return new NextResponse("Not found", { status: 404 });

    const pdf = await buildProposalPdf(proposal);
    const safeName = proposal.reference ?? `propuesta-${proposal.id.slice(0, 6)}`;

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[proposal-pdf]", err);
    return new NextResponse("Internal error", { status: 500 });
  }
}

async function buildProposalPdf(proposal: Proposal): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font     = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const W = 595.28;
  const H = 841.89;
  const M = 56; // margin
  const CONTENT_W = W - M * 2;

  let page = pdfDoc.addPage([W, H]);
  let y = H;

  // ── Header bar ────────────────────────────────────────────────────────────
  const HEADER_H = 80;
  page.drawRectangle({ x: 0, y: H - HEADER_H, width: W, height: HEADER_H, color: NAVY });

  page.drawText("PIXELTEC", {
    x: M, y: H - 38, size: 15, font: fontBold, color: WHITE,
  });
  page.drawText("Propuesta Comercial", {
    x: M, y: H - 56, size: 9, font, color: rgb(0.65, 0.70, 0.85),
  });

  // Reference (top right)
  const ref = toAscii(proposal.reference ?? "");
  if (ref) {
    const refW = fontBold.widthOfTextAtSize(ref, 9);
    page.drawText(ref, {
      x: W - M - refW, y: H - 38, size: 9, font: fontBold,
      color: rgb(0.55, 0.65, 0.90),
    });
  }

  // Version
  const ver = `v${proposal.currentVersion ?? 1}`;
  const verW = font.widthOfTextAtSize(ver, 8);
  page.drawText(ver, {
    x: W - M - verW, y: H - 56, size: 8, font,
    color: rgb(0.45, 0.50, 0.70),
  });

  y = H - HEADER_H - 36;

  // ── Title ────────────────────────────────────────────────────────────────
  const titleLines = wrapText(toAscii(proposal.title), fontBold, 22, CONTENT_W);
  for (const line of titleLines) {
    page.drawText(line, { x: M, y, size: 22, font: fontBold, color: DARK });
    y -= 28;
  }
  y -= 12;

  // ── Meta row ─────────────────────────────────────────────────────────────
  const dateStr = new Date(proposal.createdAt).toLocaleDateString("es-MX", {
    day: "2-digit", month: "long", year: "numeric",
  });

  const COL1 = M;
  const COL2 = M + CONTENT_W / 3;
  const COL3 = M + (CONTENT_W / 3) * 2;

  // light separator
  page.drawLine({
    start: { x: M, y: y + 4 },
    end: { x: W - M, y: y + 4 },
    thickness: 0.5, color: rgb(0.85, 0.85, 0.88),
  });
  y -= 6;

  drawMeta(page, fontBold, font, COL1, y, "Cliente", toAscii(proposal.clientName));
  drawMeta(page, fontBold, font, COL2, y, "Fecha", toAscii(dateStr));
  drawMeta(page, fontBold, font, COL3, y, "Referencia", toAscii(proposal.reference ?? "—"));
  y -= 36;

  page.drawLine({
    start: { x: M, y: y + 8 },
    end: { x: W - M, y: y + 8 },
    thickness: 0.5, color: rgb(0.85, 0.85, 0.88),
  });
  y -= 16;

  // ── Sections ─────────────────────────────────────────────────────────────
  const sections: Array<{ label: string; text: string }> = [
    { label: "RESUMEN EJECUTIVO", text: proposal.scope },
    ...(proposal.solution ? [{ label: "SOLUCION PROPUESTA", text: proposal.solution }] : []),
    ...(proposal.deliverables ? [{ label: "ENTREGABLES", text: proposal.deliverables }] : []),
    ...(proposal.benefits ? [{ label: "BENEFICIOS", text: proposal.benefits }] : []),
  ];

  for (const section of sections) {
    // Section label
    page.drawText(section.label, { x: M, y, size: 7, font: fontBold, color: BLUE });
    y -= 4;

    // Blue underline
    page.drawLine({
      start: { x: M, y: y + 1 },
      end: { x: M + fontBold.widthOfTextAtSize(section.label, 7) + 8, y: y + 1 },
      thickness: 1.5, color: BLUE,
    });
    y -= 12;

    const lines = wrapText(toAscii(section.text), font, 10.5, CONTENT_W);
    for (const line of lines) {
      if (y < M + 60) {
        page = pdfDoc.addPage([W, H]);
        y = H - M;
      }
      page.drawText(line, { x: M, y, size: 10.5, font, color: DARK });
      y -= 15;
    }
    y -= 16;
  }

  // ── Investment boxes ─────────────────────────────────────────────────────
  if (proposal.budget || proposal.timeline) {
    if (y < M + 80) {
      page = pdfDoc.addPage([W, H]);
      y = H - M;
    }

    const BOX_W = CONTENT_W / 2 - 8;
    const BOX_H = 56;
    const BOX_Y = y - BOX_H;

    if (proposal.budget) {
      page.drawRectangle({ x: M, y: BOX_Y, width: BOX_W, height: BOX_H, color: LGRAY });
      page.drawText("INVERSION", { x: M + 12, y: BOX_Y + BOX_H - 18, size: 7, font: fontBold, color: GRAY });
      page.drawText(toAscii(proposal.budget), {
        x: M + 12, y: BOX_Y + BOX_H - 36, size: 16, font: fontBold, color: DARK,
      });
    }

    if (proposal.timeline) {
      const COL2x = M + BOX_W + 16;
      page.drawRectangle({ x: COL2x, y: BOX_Y, width: BOX_W, height: BOX_H, color: LGRAY });
      page.drawText("TIEMPO ESTIMADO", { x: COL2x + 12, y: BOX_Y + BOX_H - 18, size: 7, font: fontBold, color: GRAY });
      page.drawText(toAscii(proposal.timeline), {
        x: COL2x + 12, y: BOX_Y + BOX_H - 36, size: 16, font: fontBold, color: DARK,
      });
    }

    y = BOX_Y - 24;
  }

  // ── Status banner ─────────────────────────────────────────────────────────
  if (proposal.status === "aceptada" && y > M + 40) {
    page.drawRectangle({
      x: M, y: y - 28, width: CONTENT_W, height: 28,
      color: rgb(0.88, 0.98, 0.91),
    });
    page.drawText(
      `Propuesta aceptada el ${proposal.acceptedAt ? new Date(proposal.acceptedAt).toLocaleDateString("es-MX") : ""}`,
      { x: M + 12, y: y - 16, size: 9, font: fontBold, color: rgb(0.08, 0.48, 0.20) },
    );
    y -= 44;
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  const lastPage = pdfDoc.getPages()[pdfDoc.getPageCount() - 1];
  lastPage.drawLine({
    start: { x: M, y: M + 30 },
    end: { x: W - M, y: M + 30 },
    thickness: 0.5, color: rgb(0.85, 0.85, 0.88),
  });
  lastPage.drawText("Gracias por confiar en nosotros.", {
    x: M, y: M + 16, size: 9, font: fontBold, color: DARK,
  });
  const footer2 = "PIXELTEC | contacto@pixeltec.mx | pixeltec.mx";
  const fw = font.widthOfTextAtSize(footer2, 8);
  lastPage.drawText(footer2, {
    x: W - M - fw, y: M + 16, size: 8, font, color: GRAY,
  });

  // Page numbers
  const pages = pdfDoc.getPages();
  if (pages.length > 1) {
    pages.forEach((pg, i) => {
      const num = `${i + 1} / ${pages.length}`;
      const nw = font.widthOfTextAtSize(num, 8);
      pg.drawText(num, {
        x: W / 2 - nw / 2, y: M - 8, size: 8, font, color: GRAY,
      });
    });
  }

  return pdfDoc.save();
}

function drawMeta(
  page: ReturnType<PDFDocument["addPage"]>,
  fontBold: { drawText?: unknown; widthOfTextAtSize(t: string, s: number): number },
  font: { drawText?: unknown; widthOfTextAtSize(t: string, s: number): number },
  x: number,
  y: number,
  label: string,
  value: string,
): void {
  (page as unknown as { drawText(t: string, opts: Record<string, unknown>): void }).drawText(label, {
    x, y: y - 2, size: 7,
    font: fontBold,
    color: GRAY,
  });
  (page as unknown as { drawText(t: string, opts: Record<string, unknown>): void }).drawText(value, {
    x, y: y - 18, size: 10,
    font: fontBold,
    color: DARK,
  });
}

function toAscii(text: string): string {
  return (text ?? "")
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/–/g, "-")
    .replace(/—/g, "--")
    .replace(/…/g, "...")
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x00-\xFF]/g, "");
}

function wrapText(
  text: string,
  font: { widthOfTextAtSize(t: string, s: number): number },
  size: number,
  maxWidth: number,
): string[] {
  const paragraphs = text.split("\n");
  const result: string[] = [];
  for (const para of paragraphs) {
    if (para.trim() === "") { result.push(""); continue; }
    const words = para.split(" ");
    let cur = "";
    for (const word of words) {
      const candidate = cur ? `${cur} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        cur = candidate;
      } else {
        if (cur) result.push(cur);
        cur = word;
      }
    }
    if (cur) result.push(cur);
  }
  return result;
}
