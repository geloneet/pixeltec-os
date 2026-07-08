import { NextRequest, NextResponse } from "next/server";
import { eq, and, asc } from "drizzle-orm";
import { resolveToken } from "@/lib/portal/token";
import { createPortalRequest, getPortalRequests } from "@/lib/portal/requests";
import { db } from "@/lib/db";
import { users, clients, projects } from "@/lib/db/schema";
import { createTask } from "@/lib/db/repos/crm";
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

// Fase 4: `crm_data/{uid}` ya no existe — el cliente y su primer proyecto
// viven en Postgres (`clients`/`projects`, source='crm_blob').
async function findBlobClientAndFirstProject(firebaseUid: string, clientFirestoreId: string) {
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.firebaseUid, firebaseUid)).limit(1);
  if (!user) return null;
  const [client] = await db
    .select({ id: clients.id, portalEnabled: clients.portalEnabled })
    .from(clients)
    .where(and(eq(clients.ownerId, user.id), eq(clients.source, "crm_blob"), eq(clients.firestoreId, clientFirestoreId)))
    .limit(1);
  if (!client) return null;
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.clientId, client.id))
    .orderBy(asc(projects.createdAt))
    .limit(1);
  return { client, project: project ?? null };
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

    // Fail closed: si no hay cliente para este uid, el portal nunca se
    // configuró para esta cuenta — no saltarse el gate de portalEnabled.
    const found = await findBlobClientAndFirstProject(uid, clientId);
    if (!found) {
      return NextResponse.json({ error: "Portal not configured" }, { status: 403 });
    }
    if (!found.client.portalEnabled) {
      return NextResponse.json({ error: "Portal disabled" }, { status: 403 });
    }

    let linkedTaskId: string | undefined;
    if (found.project) {
      const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await createTask(found.project.id, {
        firestoreId: taskId,
        name: `[PORTAL] ${safeTitle}`,
        desc: safeDescription,
        status: "pendiente",
        prio: "urgent",
        pomoSessions: 0,
      });
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

    const found = await findBlobClientAndFirstProject(resolved.uid, resolved.clientId);
    if (found && !found.client.portalEnabled) {
      return NextResponse.json({ error: "Portal disabled" }, { status: 403 });
    }

    const requests = await getPortalRequests(resolved.uid, resolved.clientId);
    return NextResponse.json({ requests });
  } catch (err) {
    console.error("[portal/requests GET]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
