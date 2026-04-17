import { NextRequest, NextResponse } from "next/server";
import { fetchVpsApi, requireSession } from "@/lib/vpsClient";

export async function POST(req: NextRequest) {
  const session = requireSession(req.cookies.get("__session")?.value);
  if (!session.ok) {
    return NextResponse.json({ error: session.error }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { data, status } = await fetchVpsApi("/projects", {
      method: "POST",
      body,
    });
    return NextResponse.json(data, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Add project failed: " + message },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const session = requireSession(req.cookies.get("__session")?.value);
  if (!session.ok) {
    return NextResponse.json({ error: session.error }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { data, status } = await fetchVpsApi("/projects", {
      method: "PUT",
      body,
    });
    return NextResponse.json(data, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Update project failed: " + message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const session = requireSession(req.cookies.get("__session")?.value);
  if (!session.ok) {
    return NextResponse.json({ error: session.error }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { data, status } = await fetchVpsApi("/projects", {
      method: "DELETE",
      body,
    });
    return NextResponse.json(data, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Delete project failed: " + message },
      { status: 500 }
    );
  }
}
