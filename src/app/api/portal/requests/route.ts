import { NextRequest, NextResponse } from "next/server";
import { resolveToken } from "@/lib/portal/token";
import { createPortalRequest, getPortalRequests } from "@/lib/portal/requests";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { enforceRateLimit, formatRetryAfter } from "@/lib/rate-limit";

interface PostBody {
  token: string;
  type: "solicitud" | "incidencia" | "mejora";
  title: string;
  description: string;
}

const ALLOWED_TYPES = ["solicitud", "incidencia", "mejora"] as const;

const TITLE_MAX = 200;
const DESCRIPTION_MAX = 2000;

const RATE_LIMIT = { max: 5, windowMs: 10 * 60 * 1000 };

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Trims, HTML-escapes and truncates free-text user input before it's persisted/rendered. */
function sanitizeText(value: unknown, maxLen: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return escapeHtml(trimmed.slice(0, maxLen));
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body: PostBody = await req.json();
    const { token, type, title, description } = body;
    if (!token || !title?.trim() || !type) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(type)) {
      return NextResponse.json({ error: "Invalid request type" }, { status: 400 });
    }

    const safeTitle = sanitizeText(title, TITLE_MAX);
    if (!safeTitle) {
      return NextResponse.json({ error: "Invalid title" }, { status: 400 });
    }
    // Description is optional, but if present it must be a non-empty string once trimmed.
    const safeDescription = description != null ? sanitizeText(description, DESCRIPTION_MAX) ?? "" : "";

    const resolved = await resolveToken(token);
    if (!resolved) return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    const { uid, clientId } = resolved;

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";
    const rl = await enforceRateLimit({
      ip,
      bucket: `portal_requests:${token}`,
      max: RATE_LIMIT.max,
      windowMs: RATE_LIMIT.windowMs,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Too many requests. Try again in ${formatRetryAfter(rl.retryAfterSec)}.` },
        { status: 429 },
      );
    }

    const db = getAdminFirestore();

    // Read CRM data — add task to first project
    const crmSnap = await db.collection("crm_data").doc(uid).get();
    // Fail closed: if there's no crm_data doc for this uid, the portal was never configured
    // for this account — do not silently skip the portalEnabled gate and create the request.
    if (!crmSnap.exists) {
      return NextResponse.json({ error: "Portal not configured" }, { status: 403 });
    }

    let linkedTaskId: string | undefined;
    const data = crmSnap.data()!;
    const clients = data.clients as Array<{ id: string; portalEnabled?: boolean; projects?: Array<{ id: string; tasks?: unknown[] }> }>;
    const client = clients.find(c => c.id === clientId);
    // Respect portalEnabled gate
    if (!client?.portalEnabled) {
      return NextResponse.json({ error: "Portal disabled" }, { status: 403 });
    }
    const project = client?.projects?.[0];
    if (project) {
      const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const newTask = {
        id: taskId,
        name: `[PORTAL] ${safeTitle}`,
        desc: safeDescription,
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

    // Create portal request
    const requestId = await createPortalRequest({
      uid, clientId, token, type,
      title: safeTitle,
      description: safeDescription,
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

    // Check portalEnabled
    const db = getAdminFirestore();
    const crmSnap = await db.collection("crm_data").doc(resolved.uid).get();
    if (crmSnap.exists) {
      const clients = (crmSnap.data()?.clients ?? []) as Array<{ id: string; portalEnabled?: boolean }>;
      const client = clients.find(c => c.id === resolved.clientId);
      if (!client?.portalEnabled) {
        return NextResponse.json({ error: "Portal disabled" }, { status: 403 });
      }
    }

    const requests = await getPortalRequests(resolved.uid, resolved.clientId);
    return NextResponse.json({ requests });
  } catch (err) {
    console.error("[portal/requests GET]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
