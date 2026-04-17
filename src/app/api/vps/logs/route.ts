import { NextRequest, NextResponse } from "next/server";
import { fetchVpsApi, requireSession } from "@/lib/vpsClient";

export async function GET(req: NextRequest) {
  const session = requireSession(req.cookies.get("__session")?.value);
  if (!session.ok) {
    return NextResponse.json({ error: session.error }, { status: 401 });
  }

  const projectId = req.nextUrl.searchParams.get("project");
  const lines = req.nextUrl.searchParams.get("lines") || "10";
  const filter = req.nextUrl.searchParams.get("filter") || "";

  try {
    const { data, status } = await fetchVpsApi("/logs", {
      query: {
        project: projectId ?? undefined,
        lines,
        filter: filter || undefined,
      },
    });
    return NextResponse.json(data, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Logs failed: " + message },
      { status: 500 }
    );
  }
}
