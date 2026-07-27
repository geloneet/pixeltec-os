/**
 * Política central de salida a servicios externos — fail-closed.
 *
 * Regla de diseño: **la ausencia de configuración bloquea**. Antes de este
 * módulo, lo único que impedía que un entorno de desarrollo enviara correos a
 * clientes reales o reiniciara el VPS de producción era que faltaran las
 * credenciales. Eso es protección accidental: el día que alguien pega una clave
 * real para probar una plantilla, el entorno se vuelve productivo sin avisar.
 *
 * Aquí el permiso es explícito y por canal. Nada se infiere de la existencia de
 * credenciales, ni de `NODE_ENV` por sí solo.
 *
 * Los consumidores importan el helper de su canal —`assertEmailEgressAllowed`,
 * `assertWhatsAppEgressAllowed`, `assertVpsEgressAllowed`,
 * `assertR2EgressAllowed`— y nunca leen las variables de entorno de política
 * directamente: la interpretación vive solo aquí.
 */

export type EgressChannel = "email" | "whatsapp" | "vps" | "r2";

export type EgressOperation =
  | "send"
  | "upload"
  | "delete"
  | "deploy"
  | "restart"
  | "pause"
  | "resume"
  | "backup"
  | "snapshot"
  | "read";

export type EgressRequest = {
  channel: EgressChannel;
  operation: EgressOperation;
  target?: string;
};

export type EgressMode = "disabled" | "allowlist" | "live";

/**
 * Razones de bloqueo. Son etiquetas estables y no sensibles: describen la
 * política violada, nunca el destino concreto.
 */
export type EgressBlockReason =
  | "mode_disabled"
  | "mode_invalid"
  | "allowlist_empty"
  | "target_missing"
  | "target_invalid"
  | "target_not_allowed"
  | "live_outside_production"
  | "production_target_from_non_production"
  | "delete_not_authorized";

/**
 * Error tipado y estable.
 *
 * Deliberadamente **no** transporta el destino: un correo, un teléfono o una
 * URL con query string acabarían en logs y trazas. Quien captura decide si
 * registra algo, y con qué nivel de detalle.
 */
export class EgressBlockedError extends Error {
  readonly code = "EGRESS_BLOCKED" as const;
  readonly channel: EgressChannel;
  readonly operation: EgressOperation;
  readonly reason: EgressBlockReason;

  constructor(input: {
    channel: EgressChannel;
    operation: EgressOperation;
    reason: EgressBlockReason;
  }) {
    super(`EGRESS_BLOCKED: ${input.channel}/${input.operation} (${input.reason})`);
    this.name = "EgressBlockedError";
    this.channel = input.channel;
    this.operation = input.operation;
    this.reason = input.reason;
  }
}

// ── Configuración por canal ───────────────────────────────────────────────────

const MODE_ENV: Record<EgressChannel, string> = {
  email: "EGRESS_EMAIL_MODE",
  whatsapp: "EGRESS_WHATSAPP_MODE",
  vps: "EGRESS_VPS_MODE",
  r2: "EGRESS_R2_MODE",
};

const ALLOWLIST_ENV: Record<EgressChannel, string> = {
  email: "EGRESS_EMAIL_ALLOWLIST",
  whatsapp: "EGRESS_WHATSAPP_ALLOWLIST",
  vps: "EGRESS_VPS_HOST_ALLOWLIST",
  r2: "EGRESS_R2_BUCKET_ALLOWLIST",
};

/**
 * Identidades que pertenecen a producción y no deben alcanzarse desde otro
 * entorno **aunque alguien las añada a una allowlist**. Es la red de seguridad
 * frente al error de configuración.
 */
const PRODUCTION_VPS_HOSTNAMES = new Set(["api.pixeltec.mx"]);

const HOSTS_LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function env(name: string): string | undefined {
  const raw = process.env[name];
  return typeof raw === "string" ? raw : undefined;
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Solo `true` autoriza. Se normaliza con trim + lowercase; nada más cuenta. */
function flagIsTrue(name: string): boolean {
  return (env(name) ?? "").trim().toLowerCase() === "true";
}

function block(
  channel: EgressChannel,
  operation: EgressOperation,
  reason: EgressBlockReason
): never {
  throw new EgressBlockedError({ channel, operation, reason });
}

/**
 * Modo efectivo del canal: override específico, luego default, luego
 * `disabled`. Un valor presente pero inválido **no** cae al default — sería
 * degradar un error de configuración a permiso.
 */
function resolveMode(channel: EgressChannel): EgressMode | "invalid" {
  const override = env(MODE_ENV[channel]);
  const fallback = env("EGRESS_DEFAULT_MODE");
  const raw = override !== undefined ? override : fallback;

  if (raw === undefined) return "disabled";

  const normalized = raw.trim().toLowerCase();
  if (normalized === "") return "invalid";
  if (normalized === "disabled" || normalized === "allowlist" || normalized === "live") {
    return normalized;
  }
  return "invalid";
}

/** Entradas de una allowlist, ya normalizadas y sin vacíos. */
function readAllowlist(channel: EgressChannel): string[] {
  return (env(ALLOWLIST_ENV[channel]) ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

/**
 * Motor de política. Recibe el destino **ya normalizado por el helper del
 * canal**: aquí la comparación es exacta, nunca por inclusión ni por sufijo.
 */
export function assertEgressAllowed(request: EgressRequest): void {
  const { channel, operation, target } = request;
  const mode = resolveMode(channel);

  if (mode === "invalid") block(channel, operation, "mode_invalid");
  if (mode === "disabled") block(channel, operation, "mode_disabled");

  if (mode === "live") {
    if (isProduction()) return;
    if (flagIsTrue("EGRESS_ALLOW_LIVE_OUTSIDE_PRODUCTION")) return;
    block(channel, operation, "live_outside_production");
  }

  // mode === "allowlist"
  const allowlist = readAllowlist(channel);
  if (allowlist.length === 0) block(channel, operation, "allowlist_empty");

  const normalizedTarget = (target ?? "").trim().toLowerCase();
  if (normalizedTarget === "") block(channel, operation, "target_missing");
  if (!allowlist.includes(normalizedTarget)) {
    block(channel, operation, "target_not_allowed");
  }
}

// ── Helpers por canal ─────────────────────────────────────────────────────────

/** Sintaxis mínima de correo. No pretende validar RFC 5322, solo descartar basura. */
const EMAIL_RE = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;

/**
 * Autoriza un envío de correo comprobando **todos** los destinatarios: To, CC y
 * BCC. Basta que uno no esté permitido para bloquear el envío entero — un CC
 * olvidado hacia un cliente real es exactamente el accidente que esto previene.
 */
export function assertEmailEgressAllowed(recipients: {
  to?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
}): void {
  const all = [recipients.to, recipients.cc, recipients.bcc]
    .flatMap((value) => (Array.isArray(value) ? value : value ? [value] : []))
    .map((address) => address.trim().toLowerCase())
    .filter((address) => address.length > 0);

  if (all.length === 0) block("email", "send", "target_missing");
  if (all.some((address) => !EMAIL_RE.test(address))) {
    block("email", "send", "target_invalid");
  }

  for (const address of all) {
    assertEgressAllowed({ channel: "email", operation: "send", target: address });
  }
}

/**
 * Forma canónica E.164 **solo para autorizar**. El número que se entrega a Meta
 * no se toca: cambiar el destinatario real a espaldas del llamador sería peor
 * que bloquearlo.
 */
export function toE164(phone: string): string | null {
  const compact = (phone ?? "").replace(/[\s()\-.]/g, "");
  const withPlus = compact.startsWith("+") ? compact : `+${compact}`;
  return /^\+[1-9][0-9]{7,14}$/.test(withPlus) ? withPlus : null;
}

export function assertWhatsAppEgressAllowed(phone: string): void {
  const canonical = toE164(phone ?? "");
  if (canonical === null) block("whatsapp", "send", "target_invalid");
  assertEgressAllowed({ channel: "whatsapp", operation: "send", target: canonical });
}

/**
 * Autoriza una operación contra la API del VPS.
 *
 * Sustituye al fallback que había en `vpsClient.ts`, donde la ausencia de
 * `VPS_API_URL` caía a `https://api.pixeltec.mx`: un entorno sin configurar
 * apuntaba a producción. Aquí la ausencia bloquea.
 */
export function assertVpsEgressAllowed(
  rawUrl: string | undefined,
  operation: EgressOperation
): void {
  if (!rawUrl || rawUrl.trim() === "") block("vps", operation, "target_missing");

  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    block("vps", operation, "target_invalid");
  }

  // Credenciales embebidas en la URL: nunca legítimas aquí.
  if (url.username !== "" || url.password !== "") {
    block("vps", operation, "target_invalid");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    block("vps", operation, "target_invalid");
  }

  const hostname = url.hostname.toLowerCase();

  // El host productivo queda vetado fuera de producción incluso si alguien lo
  // añade a la allowlist por error.
  if (!isProduction() && PRODUCTION_VPS_HOSTNAMES.has(hostname)) {
    block("vps", operation, "production_target_from_non_production");
  }

  // Texto plano solo contra loopback; cualquier host remoto exige TLS.
  if (!isProduction() && url.protocol === "http:" && !HOSTS_LOOPBACK.has(hostname)) {
    block("vps", operation, "target_invalid");
  }

  assertEgressAllowed({ channel: "vps", operation, target: hostname });
}

/**
 * Autoriza una mutación en R2. `upload` y `delete` se distinguen a propósito:
 * un borrado es irreversible y fuera de producción exige un reconocimiento
 * adicional además del modo y la allowlist.
 *
 * Los buckets productivos se declaran en `EGRESS_R2_PRODUCTION_BUCKETS` y
 * quedan vetados fuera de producción aunque estén en la allowlist.
 */
export function assertR2EgressAllowed(
  bucket: string | undefined,
  operation: "upload" | "delete"
): void {
  const normalized = (bucket ?? "").trim().toLowerCase();
  if (normalized === "") block("r2", operation, "target_missing");

  const productionBuckets = new Set(
    (env("EGRESS_R2_PRODUCTION_BUCKETS") ?? "")
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => entry.length > 0)
  );
  if (!isProduction() && productionBuckets.has(normalized)) {
    block("r2", operation, "production_target_from_non_production");
  }

  if (operation === "delete" && !isProduction() && !flagIsTrue("EGRESS_R2_ALLOW_DELETE")) {
    block("r2", operation, "delete_not_authorized");
  }

  assertEgressAllowed({ channel: "r2", operation, target: normalized });
}
