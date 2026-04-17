/**
 * Cliente centralizado para el vps-api (infraestructura DevOps del VPS).
 *
 * Reemplaza 8 fetch() duplicados que antes vivían en src/app/api/vps/*\/route.ts.
 * Cada route handler del CRM valida la cookie de sesión y luego delega a
 * fetchVpsApi() para hablar con el backend.
 *
 * Variables de entorno (en .env.production en el VPS):
 *   VPS_API_URL    URL base del vps-api (default: https://api.pixeltec.mx)
 *   CRON_SECRET    Secret para autenticar contra el vps-api
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
  return process.env.CRON_SECRET || "";
}

export async function fetchVpsApi<T = unknown>(
  path: string,
  options: VpsRequestOptions = {}
): Promise<VpsResponse<T>> {
  const secret = getSecret();
  if (!secret) {
    throw new Error("CRON_SECRET env var is not set — cannot authenticate to vps-api");
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

/** Valida la cookie de sesión del CRM antes de hablar al vps-api. */
export function requireSession(
  sessionCookie: string | undefined
): { ok: true } | { ok: false; error: string } {
  if (!sessionCookie) return { ok: false, error: "Unauthorized" };
  return { ok: true };
}
