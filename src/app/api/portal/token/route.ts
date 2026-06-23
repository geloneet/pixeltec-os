import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession } from "@/lib/vpsClient";
import { generatePortalToken, revokePortalToken } from "@/lib/portal/token";

async function getAuth(): Promise<{ ok: true; uid: string } | { ok: false }> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("__session")?.value ?? "";
  return requireSession(sessionCookie);
}

// GET /api/portal/token?clientId=X  — generate or rotate token
export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getAuth();
  if (!session.ok) return new NextResponse("Unauthorized", { status: 401 });

  const clientId = req.nextUrl.searchParams.get("clientId");
  if (!clientId) return new NextResponse("Missing clientId", { status: 400 });

  try {
    const token = await generatePortalToken(session.uid, clientId);
    return NextResponse.json({ token });
  } catch (err) {
    console.error("[portal/token GET]", err);
    return new NextResponse("Internal error", { status: 500 });
  }
}

// DELETE /api/portal/token?clientId=X  — revoke
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const session = await getAuth();
  if (!session.ok) return new NextResponse("Unauthorized", { status: 401 });

  const clientId = req.nextUrl.searchParams.get("clientId");
  if (!clientId) return new NextResponse("Missing clientId", { status: 400 });

  try {
    await revokePortalToken(session.uid, clientId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[portal/token DELETE]", err);
    return new NextResponse("Internal error", { status: 500 });
  }
}
