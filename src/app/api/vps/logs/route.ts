import { NextRequest, NextResponse } from "next/server";

const VPS_API = "http://host.docker.internal:3005";
const SECRET = process.env.CRON_SECRET || "";

export async function GET(req: NextRequest) {
  const sessionCookie = req.cookies.get("__session")?.value;
  if (!sessionCookie) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projectId = req.nextUrl.searchParams.get("project");

  try {
    const res = await fetch(
      `${VPS_API}/logs?secret=${SECRET}&project=${projectId}`,
      { cache: "no-store" }
    );
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Logs failed: " + error.message },
      { status: 500 }
    );
  }
}
