import { NextRequest, NextResponse } from "next/server";
import { readPortalSessionClientId } from "@/lib/client-portal/cookie";
import { resolveClientPgId, findContractByPublicId } from "@/lib/documents/pg";
import { isPortalAccessEnabled } from "@/lib/client-portal/pg";
import { resolveContractClientName, generateContractPdf, safeContractFilename } from "@/lib/documents/contract-pdf-render";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const contractId = req.nextUrl.searchParams.get("contractId");
    if (!contractId) {
      return new NextResponse("Missing contractId", { status: 400 });
    }

    const publicClientId = await readPortalSessionClientId();
    if (!publicClientId) return new NextResponse("Unauthorized", { status: 401 });

    const clientPgId = await resolveClientPgId(publicClientId);
    if (!clientPgId || !(await isPortalAccessEnabled(clientPgId))) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const contract = await findContractByPublicId(contractId);
    if (!contract) return new NextResponse("Contract not found", { status: 404 });

    // Anti-IDOR: el contrato debe pertenecer exactamente al cliente de la
    // sesión Y estar firmado — mismo filtro que ve el dashboard.
    if (contract.clientId !== publicClientId || contract.status !== "firmado") {
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
    console.error("[portal-contract-pdf]", err);
    return new NextResponse("Internal error", { status: 500 });
  }
}
