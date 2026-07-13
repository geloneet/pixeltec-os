import { NextRequest, NextResponse } from "next/server";
import { readPortalSessionClientId } from "@/lib/client-portal/cookie";
import { resolveClientPgId, findContractByPublicId } from "@/lib/documents/pg";
import { isPortalAccessEnabled } from "@/lib/client-portal/pg";
import { contractPdfResponse } from "@/lib/documents/contract-pdf-render";

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

    return await contractPdfResponse(contract);
  } catch (err) {
    console.error("[portal-contract-pdf]", err);
    return new NextResponse("Internal error", { status: 500 });
  }
}
