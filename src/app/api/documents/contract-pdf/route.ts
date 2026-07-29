import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import { findContractByPublicId } from "@/lib/documents/pg";
import { contractPdfResponse } from "@/lib/documents/contract-pdf-render";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const contractId = req.nextUrl.searchParams.get("contractId");
    if (!contractId) {
      return new NextResponse("Missing contractId", { status: 400 });
    }
    const userId = await getSessionUserId();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const contract = await findContractByPublicId(contractId);
    if (!contract) {
      return new NextResponse("Contract not found", { status: 404 });
    }
    if (contract.uid !== userId) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    return await contractPdfResponse(contract);
  } catch (err) {
    console.error("[contract-pdf]", err);
    return new NextResponse("Internal error", { status: 500 });
  }
}
