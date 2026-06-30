import { NextRequest, NextResponse } from "next/server";
import { getProposalByToken, updateProposalActionStatus } from "@/lib/documents/proposals-admin";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json() as { token?: string; action?: string };
    const { token, action } = body;

    if (!token || (action !== "aceptada" && action !== "rechazada")) {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }

    const proposal = await getProposalByToken(token);
    if (!proposal) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const result = await updateProposalActionStatus(proposal, action);
    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: 409 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[proposals/action]", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
