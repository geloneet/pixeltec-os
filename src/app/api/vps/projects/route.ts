import { NextRequest, NextResponse } from "next/server";
import { fetchVpsApi } from "@/lib/vpsClient";
import { requireAdmin } from "@/lib/auth-guards";
import { jsonFailure, toRouteFailure } from "@/lib/errors/route-failure";

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req.cookies.get("__session")?.value, {
    route: "/api/vps/projects",
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  try {
    const { data, status } = await fetchVpsApi("/projects");
    return NextResponse.json(data, { status });
  } catch (error) {
    console.error("[vps/projects GET] error:", error);
    return jsonFailure(
      toRouteFailure(error, {
        code: "vps_projects_get_failed",
        message: "Get projects failed",
        status: 500,
      })
    );
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req.cookies.get("__session")?.value, {
    route: "/api/vps/projects",
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  try {
    const body = await req.json();
    const { data, status } = await fetchVpsApi("/projects", {
      method: "POST",
      body,
    });
    return NextResponse.json(data, { status });
  } catch (error) {
    console.error("[vps/projects POST] error:", error);
    return jsonFailure(
      toRouteFailure(error, {
        code: "vps_projects_add_failed",
        message: "Add project failed",
        status: 500,
      })
    );
  }
}

export async function PUT(req: NextRequest) {
  const guard = await requireAdmin(req.cookies.get("__session")?.value, {
    route: "/api/vps/projects",
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  try {
    const body = await req.json();
    const { data, status } = await fetchVpsApi("/projects", {
      method: "PUT",
      body,
    });
    return NextResponse.json(data, { status });
  } catch (error) {
    console.error("[vps/projects PUT] error:", error);
    return jsonFailure(
      toRouteFailure(error, {
        code: "vps_projects_update_failed",
        message: "Update project failed",
        status: 500,
      })
    );
  }
}

export async function DELETE(req: NextRequest) {
  const guard = await requireAdmin(req.cookies.get("__session")?.value, {
    route: "/api/vps/projects",
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  try {
    const body = await req.json();
    const { data, status } = await fetchVpsApi("/projects", {
      method: "DELETE",
      body,
    });
    return NextResponse.json(data, { status });
  } catch (error) {
    console.error("[vps/projects DELETE] error:", error);
    return jsonFailure(
      toRouteFailure(error, {
        code: "vps_projects_delete_failed",
        message: "Delete project failed",
        status: 500,
      })
    );
  }
}
