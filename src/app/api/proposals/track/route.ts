import { NextRequest, NextResponse } from "next/server";
import { getProposalByToken, logProposalView } from "@/lib/documents/proposals-admin";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { token } = await req.json() as { token?: string };
    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }

    const proposal = await getProposalByToken(token);
    if (!proposal) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      undefined;
    const userAgent = req.headers.get("user-agent") ?? undefined;

    await logProposalView(proposal, ip, userAgent);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[proposals/track]", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
