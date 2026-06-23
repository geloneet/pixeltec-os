import { NextRequest, NextResponse } from "next/server";
import { resolveToken } from "@/lib/portal/token";
import { createPortalRequest, getPortalRequests } from "@/lib/portal/requests";
import { getAdminFirestore } from "@/lib/firebase-admin";

interface PostBody {
  token: string;
  type: "solicitud" | "incidencia" | "mejora";
  title: string;
  description: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body: PostBody = await req.json();
    const { token, type, title, description } = body;
    if (!token || !title?.trim() || !type) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const resolved = await resolveToken(token);
    if (!resolved) return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    const { uid, clientId } = resolved;

    const db = getAdminFirestore();

    // Read CRM data — add task to first project
    const crmSnap = await db.collection("crm_data").doc(uid).get();
    let linkedTaskId: string | undefined;
    if (crmSnap.exists) {
      const data = crmSnap.data()!;
      const clients = data.clients as Array<{ id: string; projects?: Array<{ id: string; tasks?: unknown[] }> }>;
      const client = clients.find(c => c.id === clientId);
      const project = client?.projects?.[0];
      if (project) {
        const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const newTask = {
          id: taskId,
          name: `[PORTAL] ${title.trim()}`,
          desc: description?.trim() ?? "",
          status: "pendiente",
          prio: "urgent",
          createdAt: new Date().toISOString(),
          pomoSessions: 0,
        };
        const updatedClients = clients.map(c => {
          if (c.id !== clientId) return c;
          return {
            ...c,
            projects: (c.projects ?? []).map((p, i) =>
              i === 0 ? { ...p, tasks: [...(p.tasks ?? []), newTask] } : p,
            ),
          };
        });
        await db.collection("crm_data").doc(uid).update({ clients: updatedClients });
        linkedTaskId = taskId;
      }
    }

    // Create portal request
    const requestId = await createPortalRequest({
      uid, clientId, token, type,
      title: title.trim(),
      description: description?.trim() ?? "",
      status: "recibida",
      linkedTaskId,
    });

    return NextResponse.json({ ok: true, requestId });
  } catch (err) {
    console.error("[portal/requests POST]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const token = req.nextUrl.searchParams.get("token");
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

    const resolved = await resolveToken(token);
    if (!resolved) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const requests = await getPortalRequests(resolved.uid, resolved.clientId);
    return NextResponse.json({ requests });
  } catch (err) {
    console.error("[portal/requests GET]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
