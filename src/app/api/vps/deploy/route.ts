import { NextRequest, NextResponse } from "next/server";
import { deployVpsProject, requireSession } from "@/lib/vpsClient";

export async function POST(req: NextRequest) {
  const session = requireSession(req.cookies.get("__session")?.value);
  if (!session.ok) {
    return NextResponse.json({ error: session.error }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { data, status } = await deployVpsProject(body.projectId);
    return NextResponse.json(data, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Deploy failed: " + message },
      { status: 500 }
    );
  }
}
