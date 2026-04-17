import { NextRequest, NextResponse } from "next/server";
import { fetchVpsApi, requireSession } from "@/lib/vpsClient";

export async function GET(req: NextRequest) {
  const session = requireSession(req.cookies.get("__session")?.value);
  if (!session.ok) {
    return NextResponse.json({ error: session.error }, { status: 401 });
  }

  try {
    const { data, status } = await fetchVpsApi("/status");
    return NextResponse.json(data, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Failed to connect to VPS API: " + message },
      { status: 500 }
    );
  }
}
