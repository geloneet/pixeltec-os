import { NextRequest, NextResponse } from "next/server";
import { fetchVpsApi, requireSession } from "@/lib/vpsClient";

export async function GET(req: NextRequest) {
  const session = requireSession(req.cookies.get("__session")?.value);
  if (!session.ok) {
    return NextResponse.json({ error: session.error }, { status: 401 });
  }

  try {
    const { data, status } = await fetchVpsApi("/health");
    return NextResponse.json(data, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Health check failed: " + message },
      { status: 500 }
    );
  }
}
