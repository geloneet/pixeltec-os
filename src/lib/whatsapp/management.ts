/**
 * Cliente de GESTIÓN de WhatsApp Business (Graph API) — WO-2026-00181.
 *
 * Hermano de `sender.ts`, con el que comparte transporte y disciplina: mismas
 * env (`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`,
 * `WHATSAPP_API_VERSION`) más `WHATSAPP_BUSINESS_ACCOUNT_ID`, timeout con
 * `AbortSignal`, `redirect: "manual"`, ids enmascarados en logs y **el token
 * jamás en un log, una respuesta o un error**.
 *
 * Lo que aquel hace —mandar mensajes, permiso `whatsapp_business_messaging`—
 * este lo complementa con los activos del negocio: número, perfil de empresa y
 * plantillas, incluida su creación. Es la superficie que Meta exige poder ver
 * funcionando para aprobar `whatsapp_business_management`.
 *
 * Reference:
 *   - https://developers.facebook.com/docs/whatsapp/business-management-api
 *   - https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates
 *
 * Diferencia deliberada con `sender.ts` en el saneamiento de errores: allí el
 * `error.message` de Meta se DESCARTA porque puede citar el cuerpo enviado, es
 * decir el mensaje de un cliente. Aquí no hay mensaje de cliente en juego —el
 * cuerpo es una plantilla que redacta el propio operador— y sin el texto de
 * Meta («el nombre ya existe», «idioma no soportado») el revisor no puede
 * corregir nada. Se conserva `error_user_msg`/`error.message` recortado y con
 * el token redactado; el resto del cuerpo (`error_data`, `fbtrace_id`,
 * subcódigos) no cruza.
 */

import { EgressBlockedError, assertEgressAllowed } from "@/lib/egress-guard";
import type {
  BusinessProfile,
  MessageTemplate,
  MessageTemplateComponent,
  PhoneNumberInfo,
  TemplateCreated,
} from "./management-types";
import { buildTemplateCreatePayload } from "./template-builder";

// Mismo criterio que sender.ts: una conexión retenida sin timeout bloquea la
// vista entera del revisor.
const MANAGEMENT_TIMEOUT_MS = 15_000;

const DEFAULT_API_VERSION = "v21.0";
const DEFAULT_GRAPH_BASE_URL = "https://graph.facebook.com";

/** Longitud máxima del texto de Meta que se propaga al cliente. */
const MAX_META_MESSAGE = 300;

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/**
 * Destino sintético para la política de egress. El canal `whatsapp` autoriza
 * DESTINATARIOS de mensajes (`EGRESS_WHATSAPP_ALLOWLIST` es una lista de
 * teléfonos) y una operación de gestión no tiene destinatario.
 */
const MANAGEMENT_TARGET = "waba:management";

/**
 * Razones de bloqueo que dependen del destino concreto y que aquí NO aplican:
 * la allowlist enumera teléfonos de clientes, no activos de la cuenta.
 */
const RAZONES_DE_DESTINO = new Set(["allowlist_empty", "target_missing", "target_not_allowed"]);

export class ManagementError extends Error {
  /** Status HTTP con el que debe salir la ruta que lo captura. */
  readonly status: number;
  /** Código numérico de Meta cuando la respuesta lo trae. */
  readonly code?: number;

  constructor(input: { status: number; message: string; code?: number }) {
    super(input.message);
    this.name = "ManagementError";
    this.status = input.status;
    if (input.code !== undefined) this.code = input.code;
    // Target < ES2015 rompe `instanceof` sobre subclases de Error nativas.
    Object.setPrototypeOf(this, ManagementError.prototype);
  }
}

export type ManagementConfig =
  | { configured: true; phoneNumberId: string; businessAccountId: string; apiVersion: string }
  | { configured: false; missing: string[] };

/** `***` + los últimos 4: suficiente para correlacionar en logs, inútil para reutilizar. */
export function maskId(value: string): string {
  return value.length <= 4 ? "***" : `***${value.slice(-4)}`;
}

function envTrim(name: string): string {
  const raw = process.env[name];
  return typeof raw === "string" ? raw.trim() : "";
}

/**
 * Base de Graph. `WHATSAPP_GRAPH_BASE_URL` existe SOLO para apuntar el smoke de
 * navegador a un mock local, así que se honra únicamente fuera de producción y
 * solo si es loopback: cualquier otro host —o producción— vuelve a
 * `https://graph.facebook.com`. Un override remoto significaría mandar el token
 * de Meta a un tercero, y eso no puede depender de un `.env` mal copiado. Se
 * conserva solo el origen: ruta, credenciales y query del override se ignoran.
 */
function resolveGraphBaseUrl(): string {
  const raw = envTrim("WHATSAPP_GRAPH_BASE_URL");
  if (raw === "") return DEFAULT_GRAPH_BASE_URL;
  if (process.env.NODE_ENV === "production") return DEFAULT_GRAPH_BASE_URL;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return DEFAULT_GRAPH_BASE_URL;
  }
  if (url.username !== "" || url.password !== "") return DEFAULT_GRAPH_BASE_URL;
  if (url.protocol !== "http:" && url.protocol !== "https:") return DEFAULT_GRAPH_BASE_URL;
  if (!LOOPBACK_HOSTS.has(url.hostname.toLowerCase())) return DEFAULT_GRAPH_BASE_URL;
  return url.origin;
}

interface ResolvedEnv {
  token: string;
  phoneNumberId: string;
  businessAccountId: string;
  apiVersion: string;
  baseUrl: string;
}

/** Env que faltan, en orden estable para que la UI las liste igual siempre. */
function missingEnv(): string[] {
  return (
    ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_BUSINESS_ACCOUNT_ID"] as const
  ).filter((name) => envTrim(name) === "");
}

/**
 * Estado de configuración **sin el token**: lo consumen las rutas y acaba en el
 * navegador, así que la credencial no entra en el objeto ni por descuido.
 */
export function getManagementConfig(): ManagementConfig {
  const missing = missingEnv();
  if (missing.length > 0) return { configured: false, missing };
  return {
    configured: true,
    phoneNumberId: envTrim("WHATSAPP_PHONE_NUMBER_ID"),
    businessAccountId: envTrim("WHATSAPP_BUSINESS_ACCOUNT_ID"),
    apiVersion: envTrim("WHATSAPP_API_VERSION") || DEFAULT_API_VERSION,
  };
}

/** Igual que el anterior, pero con el token: privado a este módulo. */
function resolveEnv(): ResolvedEnv {
  const missing = missingEnv();
  if (missing.length > 0) {
    throw new ManagementError({
      status: 503,
      message: `WhatsApp Business Management no está configurado. Falta: ${missing.join(", ")}.`,
    });
  }
  return {
    token: envTrim("WHATSAPP_ACCESS_TOKEN"),
    phoneNumberId: envTrim("WHATSAPP_PHONE_NUMBER_ID"),
    businessAccountId: envTrim("WHATSAPP_BUSINESS_ACCOUNT_ID"),
    apiVersion: envTrim("WHATSAPP_API_VERSION") || DEFAULT_API_VERSION,
    baseUrl: resolveGraphBaseUrl(),
  };
}

/**
 * Política de egress para gestión.
 *
 * Regla aplicada: se reutiliza el motor público del guard sobre el canal
 * `whatsapp`, de modo que `EGRESS_WHATSAPP_MODE=disabled` (y también un modo
 * inválido, o `live` fuera de producción sin `EGRESS_ALLOW_LIVE_OUTSIDE_
 * PRODUCTION`) bloquea una lectura o una creación exactamente igual que
 * bloquea un envío. Lo único que se ignora son las razones ligadas al destino:
 * la allowlist del canal enumera teléfonos de clientes y una llamada de gestión
 * va contra nuestros propios activos, sin destinatario que autorizar. Nada se
 * reimplementa: la resolución de modo sigue viviendo solo en `egress-guard.ts`.
 */
function assertManagementEgressAllowed(operation: "read" | "publish"): void {
  try {
    assertEgressAllowed({ channel: "whatsapp", operation, target: MANAGEMENT_TARGET });
  } catch (err) {
    if (err instanceof EgressBlockedError && RAZONES_DE_DESTINO.has(err.reason)) return;
    throw err;
  }
}

/** Quita el token de cualquier texto antes de que salga del módulo. */
function redactToken(text: string, token: string): string {
  if (token === "" || !text.includes(token)) return text;
  return text.split(token).join(`***${token.slice(-4)}`);
}

interface GraphErrorBody {
  message?: unknown;
  error_user_msg?: unknown;
  code?: unknown;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/**
 * Reduce un error de Graph a `{ status, code?, message }`. Del cuerpo solo se
 * leen tres campos; nada más se copia, se serializa ni se registra.
 */
function toManagementError(status: number, body: unknown, token: string): ManagementError {
  const error = asRecord(asRecord(body).error) as GraphErrorBody;
  const texto = str(error.error_user_msg) ?? str(error.message);
  const code = typeof error.code === "number" ? error.code : undefined;

  const detalle = texto
    ? redactToken(texto, token).replace(/\s+/g, " ").slice(0, MAX_META_MESSAGE)
    : "Meta no devolvió detalle.";

  return new ManagementError({
    status,
    message: `Meta rechazó la petición (${status}): ${detalle}`,
    ...(code !== undefined ? { code } : {}),
  });
}

interface GraphRequest {
  /** Path relativo a la versión, ej. `123/message_templates`. */
  path: string;
  query?: string;
  method?: "GET" | "POST";
  body?: unknown;
  operation: "read" | "publish";
  /** Etiqueta para el log; nunca lleva ids sin enmascarar. */
  label: string;
}

async function graphRequest<T>(env: ResolvedEnv, req: GraphRequest): Promise<T> {
  // Fail-closed antes de construir la petición, igual que en `sender.ts`.
  assertManagementEgressAllowed(req.operation);

  const method = req.method ?? "GET";
  const url = `${env.baseUrl}/${env.apiVersion}/${req.path}${req.query ? `?${req.query}` : ""}`;

  console.info("[whatsapp-management]", req.label, {
    method,
    phoneNumberId: maskId(env.phoneNumberId),
    wabaId: maskId(env.businessAccountId),
  });

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${env.token}`,
        "Content-Type": "application/json",
      },
      ...(req.body !== undefined ? { body: JSON.stringify(req.body) } : {}),
      // El destino de un `Location` lo elige el otro extremo: seguir el salto
      // podría llevar el `Authorization` —el token— a otro host.
      redirect: "manual",
      signal: AbortSignal.timeout(MANAGEMENT_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof DOMException && (err.name === "TimeoutError" || err.name === "AbortError")) {
      console.error("[whatsapp-management] timeout", { label: req.label });
      throw new ManagementError({
        status: 504,
        message: `Meta no respondió en ${MANAGEMENT_TIMEOUT_MS / 1000} s.`,
      });
    }
    // El error de undici cita host y puerto en `cause`; nada de él se propaga.
    console.error("[whatsapp-management] network error", { label: req.label });
    throw new ManagementError({ status: 502, message: "No se pudo contactar a Meta." });
  }

  if (res.type === "opaqueredirect" || (res.status >= 300 && res.status < 400)) {
    console.error("[whatsapp-management] redirect blocked", { label: req.label, status: res.status });
    throw new ManagementError({
      status: 502,
      message: `Meta respondió con una redirección (${res.status}) que no se sigue.`,
    });
  }

  const json = (await res.json().catch(() => ({}))) as unknown;

  if (!res.ok) {
    const error = toManagementError(res.status, json, env.token);
    console.error("[whatsapp-management] api error", {
      label: req.label,
      status: error.status,
      code: error.code ?? null,
    });
    throw error;
  }

  return json as T;
}

// ── Lecturas ─────────────────────────────────────────────────────────────────

const PHONE_FIELDS = [
  "display_phone_number",
  "verified_name",
  "quality_rating",
  "name_status",
  "code_verification_status",
  "messaging_limit_tier",
  "platform_type",
].join(",");

const PROFILE_FIELDS = [
  "about",
  "address",
  "description",
  "email",
  "profile_picture_url",
  "websites",
  "vertical",
].join(",");

const TEMPLATE_FIELDS = [
  "id",
  "name",
  "language",
  "status",
  "category",
  "components",
  "rejected_reason",
  "quality_score",
].join(",");

export async function getPhoneNumberInfo(): Promise<PhoneNumberInfo> {
  const env = resolveEnv();
  const json = await graphRequest<Record<string, unknown>>(env, {
    path: env.phoneNumberId,
    query: `fields=${PHONE_FIELDS}`,
    operation: "read",
    label: "phone-number",
  });

  return {
    id: str(json.id) ?? env.phoneNumberId,
    displayPhoneNumber: str(json.display_phone_number),
    verifiedName: str(json.verified_name),
    qualityRating: str(json.quality_rating),
    nameStatus: str(json.name_status),
    codeVerificationStatus: str(json.code_verification_status),
    messagingLimitTier: str(json.messaging_limit_tier),
    platformType: str(json.platform_type),
  };
}

export async function getBusinessProfile(): Promise<BusinessProfile> {
  const env = resolveEnv();
  const json = await graphRequest<Record<string, unknown>>(env, {
    path: `${env.phoneNumberId}/whatsapp_business_profile`,
    query: `fields=${PROFILE_FIELDS}`,
    operation: "read",
    label: "business-profile",
  });

  // Graph devuelve el perfil envuelto en `data: [{...}]`, con un solo elemento.
  const data = Array.isArray(json.data) ? json.data : [];
  const perfil = asRecord(data[0]);
  const websites = Array.isArray(perfil.websites)
    ? perfil.websites.filter((w): w is string => typeof w === "string")
    : [];

  return {
    about: str(perfil.about),
    address: str(perfil.address),
    description: str(perfil.description),
    email: str(perfil.email),
    profilePictureUrl: str(perfil.profile_picture_url),
    websites,
    vertical: str(perfil.vertical),
  };
}

function toComponent(raw: unknown): MessageTemplateComponent {
  const c = asRecord(raw);
  return {
    type: str(c.type) ?? "UNKNOWN",
    format: str(c.format),
    text: str(c.text),
  };
}

function toTemplate(raw: unknown): MessageTemplate {
  const t = asRecord(raw);
  const quality = asRecord(t.quality_score);
  return {
    id: str(t.id) ?? "",
    name: str(t.name) ?? "",
    language: str(t.language) ?? "",
    status: str(t.status) ?? "UNKNOWN",
    category: str(t.category) ?? "UNKNOWN",
    components: Array.isArray(t.components) ? t.components.map(toComponent) : [],
    rejectedReason: str(t.rejected_reason),
    qualityScore: str(quality.score) ?? str(t.quality_score),
  };
}

export async function listMessageTemplates(): Promise<MessageTemplate[]> {
  const env = resolveEnv();
  const json = await graphRequest<Record<string, unknown>>(env, {
    path: `${env.businessAccountId}/message_templates`,
    query: `fields=${TEMPLATE_FIELDS}&limit=50`,
    operation: "read",
    label: "message-templates",
  });

  return Array.isArray(json.data) ? json.data.map(toTemplate) : [];
}

// ── Creación ─────────────────────────────────────────────────────────────────

/**
 * Crea una plantilla. La validación y el payload vienen del builder puro
 * (`template-builder.ts`): si la entrada es inválida lanza
 * `TemplateValidationError` **antes** de tocar la red.
 *
 * La operación de egress es `publish`, no `read`: crear una plantilla deja un
 * activo permanente en la cuenta real y consume cuota de revisión de Meta.
 */
export async function createMessageTemplate(input: unknown): Promise<TemplateCreated> {
  const payload = buildTemplateCreatePayload(input);
  const env = resolveEnv();

  const json = await graphRequest<Record<string, unknown>>(env, {
    path: `${env.businessAccountId}/message_templates`,
    method: "POST",
    body: payload,
    operation: "publish",
    label: "create-template",
  });

  return {
    id: str(json.id) ?? "",
    // Meta responde `PENDING` en el alta normal; si no lo manda, ese es el
    // estado real de una plantilla recién enviada a revisión.
    status: str(json.status) ?? "PENDING",
    name: payload.name,
  };
}

/**
 * Traduce cualquier error de este módulo a lo que puede cruzar hacia el
 * navegador. El `message` de un error desconocido se descarta sin mirarlo
 * (mismo criterio que `@/lib/whatsapp-inbox/errors`).
 */
export function describeManagementError(
  err: unknown,
  fallback: string
): { status: number; message: string; code: "meta_error" | "egress_blocked" | "internal_error" } {
  if (err instanceof EgressBlockedError) {
    return { status: 503, message: fallback, code: "egress_blocked" };
  }
  if (err instanceof ManagementError) {
    return { status: err.status, message: err.message, code: "meta_error" };
  }
  return { status: 500, message: fallback, code: "internal_error" };
}
