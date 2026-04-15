import { NextRequest, NextResponse } from "next/server";

const VPS_API = "http://host.docker.internal:3005";
const SECRET = process.env.CRON_SECRET || "";

export async function POST(req: NextRequest) {
  const sessionCookie = req.cookies.get("__session")?.value;
  if (!sessionCookie) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const res = await fetch(`${VPS_API}/restart?secret=${SECRET}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Restart failed: " + error.message },
      { status: 500 }
    );
  }
}
