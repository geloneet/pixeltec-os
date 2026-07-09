import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession } from "@/lib/vpsClient";
import { findContractByPublicId } from "@/lib/documents/pg";
import { resolveContractClientName, generateContractPdf, safeContractFilename } from "@/lib/documents/contract-pdf-render";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const contractId = req.nextUrl.searchParams.get("contractId");
    if (!contractId) {
      return new NextResponse("Missing contractId", { status: 400 });
    }

    // Auth — session cookie (admin) only.
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("__session")?.value ?? "";
    const session = await requireSession(sessionCookie);
    if (!session.ok) return new NextResponse("Unauthorized", { status: 401 });

    const contract = await findContractByPublicId(contractId);
    if (!contract) {
      return new NextResponse("Contract not found", { status: 404 });
    }
    if (contract.uid !== session.uid) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const clientName = await resolveContractClientName(contract.clientId);
    const pdf = await generateContractPdf(contract, clientName);

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeContractFilename(contract.title, contract.version)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[contract-pdf]", err);
    return new NextResponse("Internal error", { status: 500 });
  }
}
