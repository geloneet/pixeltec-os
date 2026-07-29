/**
 * Cliente centralizado para el vps-api (infraestructura DevOps del VPS).
 *
 * Reemplaza 8 fetch() duplicados que antes vivían en src/app/api/vps/*\/route.ts.
 * Cada route handler del CRM valida la cookie de sesión y luego delega a
 * fetchVpsApi() para hablar con el backend.
 *
 * Variables de entorno (en .env.production en el VPS):
 *   VPS_API_URL      URL base del vps-api. OBLIGATORIA — ya no hay valor por
 *                    defecto: un entorno sin configurar debe fallar, no
 *                    apuntar a producción.
 *   VPS_API_SECRET   Secret para autenticar contra el vps-api — DEBE ser el
 *                    mismo valor que vps-api/.env's VPS_API_SECRET (ver
 *                    vps-api/src/auth.js). NO es CRON_SECRET — ese es el
 *                    secret de los crons internos de esta app, un valor
 *                    completamente distinto que vps-api nunca acepta.
 */

const DEFAULT_TIMEOUT_MS = 30_000;
const DEPLOY_TIMEOUT_MS = 600_000; // 10 min, para /deploy que puede tardar

import { assertVpsEgressAllowed, type EgressOperation } from "@/lib/egress-guard";

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

/**
 * Base del vps-api. Sin fallback: antes, un entorno sin `VPS_API_URL` caía a
 * `https://api.pixeltec.mx` y desarrollo operaba infraestructura productiva.
 * Ahora la ausencia se propaga y la guarda de egress la rechaza.
 */
function getBaseUrl(): string | undefined {
  const raw = process.env.VPS_API_URL?.trim();
  return raw ? raw.replace(/\/$/, "") : undefined;
}

/**
 * Operación real a partir del path, para que la guarda reciba `deploy` o
 * `restart` y no un genérico. Se deriva aquí en vez de exigirlo a las 12 rutas:
 * este wrapper es la única frontera, y tocarlas quedaba fuera del gate.
 */
/**
 * Códigos de fallo de transporte hacia el vps-api.
 *
 * Estables y opacos: describen qué ocurrió en el cable, nunca contra qué. Antes
 * los errores interpolaban `path=${path}` y el `message` del error subyacente,
 * que en undici cita host y puerto.
 */
export type VpsTransportCode =
  /** Respondió 3xx. No se sigue: el secreto viaja en la query string. */
  | "vps_redirect_blocked"
  /** Respondió algo que no es JSON (típicamente un HTML de nginx). */
  | "vps_invalid_response"
  /** Se agotó el tiempo de espera. */
  | "vps_timeout"
  /** No se pudo conectar: DNS, conexión rechazada, TLS. */
  | "vps_unreachable";

export class VpsTransportError extends Error {
  readonly code: VpsTransportCode;
  readonly status?: number;

  constructor(code: VpsTransportCode, status?: number) {
    super(`VPS_TRANSPORT_ERROR: ${code}${status !== undefined ? ` (status ${status})` : ""}`);
    this.name = "VpsTransportError";
    this.code = code;
    this.status = status;
    Object.setPrototypeOf(this, VpsTransportError.prototype);
  }
}

function operationForPath(path: string): EgressOperation {
  const segment = path.toLowerCase();
  if (segment.includes("deploy")) return "deploy";
  if (segment.includes("restart")) return "restart";
  if (segment.includes("pause")) return "pause";
  if (segment.includes("resume")) return "resume";
  if (segment.includes("backup")) return "backup";
  if (segment.includes("snapshot")) return "snapshot";
  return "read";
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
  // Fail-closed antes de construir la petición: si la política no autoriza este
  // host y operación, no se arma la URL ni se llega al fetch.
  assertVpsEgressAllowed(baseUrl, operationForPath(path));

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

    // El secreto viaja en la query string: seguir un redirect entregaría la
    // URL entera —secreto incluido— al host que elija `Location`.
    const res = await fetch(url, { ...init, redirect: "manual" });

    if (res.type === "opaqueredirect" || (res.status >= 300 && res.status < 400)) {
      // No se lee el cuerpo, no se mira `Location`, no hay segunda petición.
      throw new VpsTransportError("vps_redirect_blocked", res.status);
    }

    // Un no-2xx **no aporta cuerpo**. Antes se devolvían 500 caracteres crudos
    // de la respuesta del vps-api, que pueden citar rutas de archivo, SQL o el
    // eco del payload. Lo accionable es el status; el resto se descarta.
    if (!res.ok) {
      return { ok: false, status: res.status, data: null as T };
    }

    const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
    if (!contentType.includes("application/json")) {
      throw new VpsTransportError("vps_invalid_response", res.status);
    }

    let data: unknown;
    try {
      data = await res.json();
    } catch {
      throw new VpsTransportError("vps_invalid_response", res.status);
    }

    return { ok: true, status: res.status, data: data as T };
  } catch (err) {
    // Un fallo de transporte ya saneado sube tal cual.
    if (err instanceof VpsTransportError) throw err;

    // El resto se traduce sin mirar su `message`: undici cita host y puerto en
    // `cause`, y `path` identificaría el endpoint interno invocado.
    const abortado =
      err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError");
    throw new VpsTransportError(abortado ? "vps_timeout" : "vps_unreachable");
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
 * Gate B5 (Firebase Exit): WRAPPER TEMPORAL del contrato canónico — el "uid"
 * devuelto ahora ES `users.id`, jamás el alias Firebase. Se retira en el Gate
 * B6; código nuevo usa `getSessionUserId()`/`requireUserSession()`.
 */
export async function requireSession(
  _sessionCookie?: string
): Promise<{ ok: true; uid: string } | { ok: false; error: string }> {
  try {
    const { auth } = await import("./auth/config");
    const session = await auth();
    const uid = session?.user?.id;
    if (!uid) return { ok: false, error: "Unauthorized" };
    return { ok: true, uid };
  } catch {
    return { ok: false, error: "Session expired or invalid" };
  }
}
