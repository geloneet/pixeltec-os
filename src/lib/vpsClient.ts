/**
 * Cliente centralizado para el vps-api (infraestructura DevOps del VPS).
 *
 * Reemplaza 8 fetch() duplicados que antes vivían en src/app/api/vps/*\/route.ts.
 * Cada route handler del CRM valida la cookie de sesión y luego delega a
 * fetchVpsApi() para hablar con el backend.
 *
 * Variables de entorno (en .env.production en el VPS):
 *   VPS_API_URL      URL base del vps-api (default: https://api.pixeltec.mx)
 *   VPS_API_SECRET   Secret para autenticar contra el vps-api — DEBE ser el
 *                    mismo valor que vps-api/.env's VPS_API_SECRET (ver
 *                    vps-api/src/auth.js). NO es CRON_SECRET — ese es el
 *                    secret de los crons internos de esta app, un valor
 *                    completamente distinto que vps-api nunca acepta.
 */

const DEFAULT_VPS_API_URL = "https://api.pixeltec.mx";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEPLOY_TIMEOUT_MS = 600_000; // 10 min, para /deploy que puede tardar

export type VpsMethod = "GET" | "POST" | "PUT" | "DELETE";

export interface VpsRequestOptions {
  method?: VpsMethod;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  timeoutMs?: number;
  noStore?: boolean;
}

export interface VpsResponse<T = unknown> {
  ok: boolean;
  status: number;
  data: T;
}

function getBaseUrl(): string {
  return process.env.VPS_API_URL?.replace(/\/$/, "") || DEFAULT_VPS_API_URL;
}

function getSecret(): string {
  return process.env.VPS_API_SECRET || "";
}

export async function fetchVpsApi<T = unknown>(
  path: string,
  options: VpsRequestOptions = {}
): Promise<VpsResponse<T>> {
  const secret = getSecret();
  if (!secret) {
    throw new Error("VPS_API_SECRET env var is not set — cannot authenticate to vps-api");
  }

  const baseUrl = getBaseUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  const params = new URLSearchParams({ secret });
  if (options.query) {
    for (const [k, v] of Object.entries(options.query)) {
      if (v !== undefined) params.set(k, String(v));
    }
  }

  const url = `${baseUrl}${normalizedPath}?${params.toString()}`;
  const method = options.method ?? "GET";
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const init: RequestInit = {
      method,
      signal: controller.signal,
      cache: options.noStore === false ? "default" : "no-store",
      headers: { "Content-Type": "application/json" },
    };

    if (method !== "GET" && options.body !== undefined) {
      init.body = JSON.stringify(options.body);
    }

    const res = await fetch(url, init);
    const text = await res.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { error: "Non-JSON response from vps-api", raw: text.slice(0, 500) };
    }

    return {
      ok: res.ok,
      status: res.status,
      data: data as T,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("aborted")) {
      throw new Error(`vps-api request timed out after ${timeoutMs}ms (path=${path})`);
    }
    throw new Error(`vps-api request failed (path=${path}): ${message}`);
  } finally {
    clearTimeout(timeout);
  }
}

/** Shortcut para /deploy que usa timeout extendido de 10 min. */
export function deployVpsProject(projectId: string) {
  return fetchVpsApi("/deploy", {
    method: "POST",
    body: { projectId },
    timeoutMs: DEPLOY_TIMEOUT_MS,
  });
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface VpsServerInfo {
  diskTotal: string;
  diskUsed: string;
  diskFree: string;
  diskPercent: string;
  uptime: string;
  memTotal: string;
  memUsed: string;
  memFree: string;
}

export interface VpsProject {
  id: string;
  name: string;
  path: string;
  type: string;
  domain: string | null;
  description: string;
  status: string;
  size: string;
  active: boolean;
  pm2Name: string | null;
  containerName: string | null;
}

export interface VpsProjectPublic {
  id: string;
  name: string;
  type: string;
  domain: string | null;
  description: string;
  status: string;
  size: string;
  active: boolean;
}

export interface VpsStatusResponse {
  server: VpsServerInfo;
  projects: VpsProject[];
}

export interface VpsStatusPublicResponse {
  server: VpsServerInfo;
  projects: VpsProjectPublic[];
}

/** Elimina campos sensibles para sesiones no-admin.
 *  Hoy isAdmin siempre es true — la función está lista para cuando llegue staff.
 */
export function sanitizeVpsPayload(
  data: VpsStatusResponse,
  isAdmin: boolean
): VpsStatusResponse | VpsStatusPublicResponse {
  if (isAdmin) return data;
  return {
    server: data.server,
    projects: data.projects.map(
      ({ id, name, type, domain, description, status, size, active }) => ({
        id,
        name,
        type,
        domain,
        description,
        status,
        size,
        active,
      })
    ),
  };
}

// ── Auth ─────────────────────────────────────────────────────────────────────

/**
 * Valida la sesión del CRM antes de hablar al vps-api.
 *
 * Fase 2 de la migración (Firebase Auth → NextAuth): la sesión ya no es una
 * cookie de Firebase que el caller lee y pasa explícitamente — `auth()` de
 * NextAuth lee la sesión actual directo del request (vía el almacenamiento
 * async de Next.js), así que el parámetro `sessionCookie` ya no se usa. Se
 * mantiene en la firma a propósito para no tocar los ~10 call sites que
 * todavía leen `cookies().get("__session")` y lo pasan aquí — ese valor
 * ahora se ignora.
 *
 * El "uid" devuelto es el Firebase UID puente (`session.user.firebaseUid`),
 * no el id de Postgres — mientras los datos sigan en Firestore (Fase 3 no ha
 * corrido), todo el código que usa este uid para queries de Firestore/
 * crm_data debe seguir recibiendo el mismo valor de siempre.
 */
export async function requireSession(
  _sessionCookie?: string
): Promise<{ ok: true; uid: string } | { ok: false; error: string }> {
  try {
    const { auth } = await import("./auth/config");
    const session = await auth();
    const uid = session?.user?.firebaseUid;
    if (!uid) return { ok: false, error: "Unauthorized" };
    return { ok: true, uid };
  } catch {
    return { ok: false, error: "Session expired or invalid" };
  }
}
