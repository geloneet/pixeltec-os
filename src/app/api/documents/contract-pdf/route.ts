import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { requireSession } from "@/lib/vpsClient";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { resolveToken } from "@/lib/portal/token";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const contractId = req.nextUrl.searchParams.get("contractId");
    if (!contractId) {
      return new NextResponse("Missing contractId", { status: 400 });
    }

    // Auth — session cookie (admin) OR portal token (public portal)
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("__session")?.value ?? "";
    const session = await requireSession(sessionCookie);

    let ownerUid: string;
    if (session.ok) {
      ownerUid = session.uid;
    } else {
      // Fallback: portal token auth
      const portalToken = req.nextUrl.searchParams.get("token");
      if (!portalToken) return new NextResponse("Unauthorized", { status: 401 });
      const resolved = await resolveToken(portalToken);
      if (!resolved) return new NextResponse("Unauthorized", { status: 401 });
      ownerUid = resolved.uid;
    }

    // Fetch contract from Firestore
    const snap = await getAdminFirestore()
      .collection("contracts")
      .doc(contractId)
      .get();

    if (!snap.exists) {
      return new NextResponse("Contract not found", { status: 404 });
    }

    const contract = snap.data() as {
      uid: string;
      title: string;
      content: string;
      status: string;
      version: number;
      createdAt: string;
    };

    // Verify ownership
    if (contract.uid !== ownerUid) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // Generate PDF
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();
    const margin = 60;
    const lineHeight = 16;

    // Title — word-wrapped for long titles
    const titleLines = wrapText(toWinAnsi(contract.title), boldFont, 18, width - margin * 2);
    let titleY = height - margin - 20;
    for (const tLine of titleLines) {
      page.drawText(tLine, { x: margin, y: titleY, size: 18, font: boldFont, color: rgb(0.05, 0.05, 0.1) });
      titleY -= 22;
    }

    // Meta line
    const metaLine = toWinAnsi(`Version ${contract.version} · ${new Date(contract.createdAt).toLocaleDateString("es-MX")} · Estado: ${contract.status}`);
    page.drawText(metaLine, {
      x: margin,
      y: titleY - 5,
      size: 9,
      font,
      color: rgb(0.45, 0.45, 0.45),
    });

    // Divider
    page.drawLine({
      start: { x: margin, y: titleY - 18 },
      end: { x: width - margin, y: titleY - 18 },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });

    // Content — word-wrapped text, multi-page
    const contentLines = wrapText(toWinAnsi(contract.content ?? ""), font, 11, width - margin * 2);
    let y = titleY - 35;
    let currentPage = page;
    for (const line of contentLines) {
      if (y < margin + lineHeight) {
        currentPage = pdfDoc.addPage([595.28, 841.89]);
        y = currentPage.getSize().height - margin;
      }
      currentPage.drawText(line, { x: margin, y, size: 11, font, color: rgb(0.15, 0.15, 0.15) });
      y -= lineHeight;
    }

    const pdfBytes = await pdfDoc.save();

    const safeName = (contract.title
      .replace(/[^a-zA-Z0-9_\- ]/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .slice(0, 100)) || "contrato";
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}_v${contract.version}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[contract-pdf]", err);
    return new NextResponse("Internal error", { status: 500 });
  }
}

/** Replaces common non-WinAnsi characters; strips the rest to prevent pdf-lib errors. */
function toWinAnsi(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/–/g, "-")
    .replace(/—/g, "--")
    .replace(/…/g, "...")
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x00-\xFF]/g, "?");
}

/**
 * Splits text into lines that fit within maxWidth pixels at given font size.
 * Handles pre-existing newlines in the source text.
 */
function wrapText(
  text: string,
  font: { widthOfTextAtSize(t: string, s: number): number },
  size: number,
  maxWidth: number,
): string[] {
  const paragraphs = text.split("\n");
  const result: string[] = [];
  for (const para of paragraphs) {
    if (para.trim() === "") {
      result.push("");
      continue;
    }
    const words = para.split(" ");
    let currentLine = "";
    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        currentLine = candidate;
      } else {
        if (currentLine) result.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) result.push(currentLine);
  }
  return result;
}
