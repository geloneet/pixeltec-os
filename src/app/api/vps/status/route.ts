import { NextRequest, NextResponse } from "next/server";

const VPS_API = "http://host.docker.internal:3005";
const SECRET = process.env.CRON_SECRET || "";

export async function GET(req: NextRequest) {
  const sessionCookie = req.cookies.get("__session")?.value;
  if (!sessionCookie) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await fetch(`${VPS_API}/status?secret=${SECRET}`, {
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to connect to VPS API: " + error.message },
      { status: 500 }
    );
  }
}
