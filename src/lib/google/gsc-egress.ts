import { JWT } from "google-auth-library";
import { assertEgressAllowed, GOOGLE_SEARCH_CONSOLE_HOST } from "@/lib/egress-guard";

/**
 * Única puerta hacia la API de Google Search Console (WO-2026-00214).
 *
 * Mismo molde que `unsplash-egress.ts`: canal OPCIONAL del contrato de egress
 * —sin `EGRESS_GOOGLE_MODE=live` el guard bloquea— y error explícito de
 * configuración cuando falta la credencial. Host FIJO
 * (`searchconsole.googleapis.com`); la propiedad y las fechas viajan en el
 * cuerpo JSON, así que no hay superficie SSRF.
 *
 * **Autenticación por JWT de cuenta de servicio** con `google-auth-library`, no
 * el paquete `googleapis` completo: ese arrastra cientos de clientes de APIs
 * que este módulo nunca usa, con la superficie de dependencias que eso implica.
 * Aquí se necesita firmar un JWT y hacer un POST; nada más.
 *
 * **Nunca se propaga el cuerpo crudo de la respuesta del proveedor** (misma
 * disciplina que Unsplash y que el canal de IA): un 403 de Google incluye el
 * correo de la cuenta de servicio y la propiedad consultada, y eso acabaría en
 * logs y trazas.
 *
 * Diseño: docs/superpowers/specs/2026-09-03-seo-contenido-design.md
 */

const API_BASE = `https://${GOOGLE_SEARCH_CONSOLE_HOST}/webmasters/v3`;
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

/** Máximo por página que acepta `searchanalytics.query`. */
export const GSC_ROW_LIMIT = 25_000;

export type GscDimension = "page" | "query" | "date" | "country" | "device";

export interface GscRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscQueryInput {
  /** `sc-domain:pixeltec.mx` o la URL de la propiedad. */
  siteUrl: string;
  /** `YYYY-MM-DD`, inclusivo. */
  startDate: string;
  /** `YYYY-MM-DD`, inclusivo. */
  endDate: string;
  dimensions: GscDimension[];
  rowLimit?: number;
  startRow?: number;
}

/**
 * Credencial de cuenta de servicio. Se transporta en base64 en una sola
 * variable (`GOOGLE_SERVICE_ACCOUNT_JSON`) porque la clave privada lleva saltos
 * de línea reales y pegarla cruda en un `.env` la parte en el primer `\n`.
 */
function loadServiceAccount(): { client_email: string; private_key: string } {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw || raw.trim() === "") {
    throw new Error("gsc_not_configured");
  }

  let json: unknown;
  try {
    const decoded = Buffer.from(raw.trim(), "base64").toString("utf8");
    json = JSON.parse(decoded);
  } catch {
    // Sin detalles: el error de parseo de una credencial puede llevar trozos
    // de la propia clave.
    throw new Error("gsc_credentials_invalid");
  }

  const account = json as { client_email?: unknown; private_key?: unknown };
  if (typeof account.client_email !== "string" || typeof account.private_key !== "string") {
    throw new Error("gsc_credentials_invalid");
  }
  return { client_email: account.client_email, private_key: account.private_key };
}

/**
 * Token de acceso de la cuenta de servicio. Se pide en cada llamada al cliente
 * en vez de cachearse en un módulo: el cron corre una vez al día y una caché a
 * nivel de proceso sólo añadiría estado que puede quedar rancio.
 */
async function getAccessToken(): Promise<string> {
  const { client_email, private_key } = loadServiceAccount();
  const jwt = new JWT({ email: client_email, key: private_key, scopes: [SCOPE] });
  const { access_token: token } = await jwt.authorize();
  if (!token) throw new Error("gsc_auth_failed");
  return token;
}

/**
 * Una página de `searchanalytics.query`.
 *
 * El llamador pagina con `startRow` — esta función no itera sola a propósito:
 * quien pagina es el cron, que además tiene que meter un throttle entre
 * llamadas y registrar el avance en `seo_sync_runs`.
 */
export async function querySearchAnalytics(input: GscQueryInput): Promise<GscRow[]> {
  assertEgressAllowed({
    channel: "google",
    operation: "read",
    target: GOOGLE_SEARCH_CONSOLE_HOST,
  });

  const siteUrl = (input.siteUrl ?? "").trim();
  if (siteUrl === "") throw new Error("gsc_not_configured");

  const token = await getAccessToken();

  const res = await fetch(`${API_BASE}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      startDate: input.startDate,
      endDate: input.endDate,
      dimensions: input.dimensions,
      rowLimit: Math.min(input.rowLimit ?? GSC_ROW_LIMIT, GSC_ROW_LIMIT),
      startRow: Math.max(0, input.startRow ?? 0),
      // `web` y no `discover`/`news`: sólo interesa la búsqueda clásica, que es
      // la que la estrategia de contenido intenta mover.
      type: "web",
    }),
    signal: AbortSignal.timeout(30_000),
    cache: "no-store",
  });

  if (!res.ok) {
    // Código estable y NADA del cuerpo del proveedor: un 403 de Google incluye
    // el correo de la cuenta de servicio y la propiedad consultada.
    throw new Error(`gsc_http_${res.status}`);
  }

  const data = (await res.json()) as {
    rows?: Array<{
      keys?: unknown;
      clicks?: unknown;
      impressions?: unknown;
      ctr?: unknown;
      position?: unknown;
    }>;
  };

  return (data.rows ?? [])
    .filter((r) => Array.isArray(r.keys))
    .map((r) => ({
      keys: (r.keys as unknown[]).map((k) => String(k)),
      clicks: Number(r.clicks ?? 0),
      impressions: Number(r.impressions ?? 0),
      ctr: Number(r.ctr ?? 0),
      position: Number(r.position ?? 0),
    }));
}

/** `true` si la credencial está presente. No la valida ni la usa. */
export function isGscConfigured(): boolean {
  return (process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? "").trim() !== "";
}
