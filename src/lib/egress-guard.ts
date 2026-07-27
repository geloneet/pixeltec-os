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
 * `assertR2EgressAllowed`, `assertMetaEgressAllowed`, `assertAiEgressAllowed`—
 * y nunca leen las variables de entorno de política directamente: la
 * interpretación vive solo aquí.
 */

export type EgressChannel = "email" | "whatsapp" | "vps" | "r2" | "meta" | "ai";

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
  | "read"
  // Meta: la operación distingue el riesgo. Leer un perfil, canjear un token y
  // publicar en una cuenta real no son lo mismo, y la política los separa.
  | "oauth"
  | "token_exchange"
  | "credential_read"
  | "create_media"
  | "publish"
  // IA: la operación distingue analizar material ya existente de generar
  // contenido nuevo. Las tres transportan input del cliente hacia un tercero.
  | "analyze"
  | "generate_text"
  | "generate_image";

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
  | "delete_not_authorized"
  | "credential_read_not_authorized"
  | "publish_not_authorized"
  | "input_not_authorized";

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
  meta: "EGRESS_META_MODE",
  ai: "EGRESS_AI_MODE",
};

/**
 * Allowlist por defecto de cada canal. Meta no aparece porque usa dos listas
 * distintas según el tipo de destino —aplicación o cuenta—, y el helper indica
 * cuál corresponde en cada llamada. IA tampoco: su lista es de pares
 * `proveedor:modelo` y se exige **siempre**, también en `live` (ver
 * `assertAiEgressAllowed`), así que no puede pasar por el camino genérico.
 */
const ALLOWLIST_ENV: Partial<Record<EgressChannel, string>> = {
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

/** Entradas de una lista de configuración, normalizadas y sin vacíos. */
function readList(envName: string | undefined): string[] {
  return (env(envName ?? "") ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

/**
 * Motor de política. Recibe el destino **ya normalizado por el helper del
 * canal**: aquí la comparación es exacta, nunca por inclusión ni por sufijo.
 */
export function assertEgressAllowed(request: EgressRequest): void {
  assertEgressAllowedWithList(request, readList(ALLOWLIST_ENV[request.channel]));
}

/**
 * Igual que {@link assertEgressAllowed}, pero recibe la allowlist ya resuelta.
 * Meta lo necesita porque separa aplicaciones de cuentas en dos listas y
 * prefija sus entradas; el resto de canales usa la de su canal. Sigue siendo el
 * mismo motor: la resolución de modo no se duplica en ningún helper.
 */
function assertEgressAllowedWithList(request: EgressRequest, allowlist: string[]): void {
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

/** Destino de una operación contra Meta: una aplicación o una cuenta publicable. */
export type MetaTarget = { kind: "app"; id: string } | { kind: "account"; id: string };

export type MetaOperation =
  | "oauth"
  | "token_exchange"
  | "credential_read"
  | "read"
  | "create_media"
  | "publish";

/**
 * Autoriza una operación contra la Graph API de Meta.
 *
 * El destino se compara **prefijado** (`app:<id>` / `account:<id>`) para que un
 * identificador de aplicación nunca autorice por accidente una cuenta que
 * comparta dígitos, y cada tipo se valida contra su propia lista.
 *
 * El host no sirve como identidad: `graph.facebook.com` es el mismo para todos
 * y no dice qué aplicación ni qué cuenta está operando.
 *
 * Tres niveles de riesgo, no uno:
 *
 *  - `read` — lecturas inocuas.
 *  - `token_exchange` y `credential_read` — devuelven o canjean credenciales.
 *    `getFacebookPages` entra aquí porque su respuesta incluye tokens de página.
 *  - `create_media` y `publish` — tocan cuentas reales. `create_media` va con
 *    publicación y no aparte: es su primer paso y consume cuota, así que
 *    habilitarlo por separado dejaría media publicación abierta.
 */
export function assertMetaEgressAllowed(input: {
  operation: MetaOperation;
  target: MetaTarget;
}): void {
  const { operation, target } = input;

  const id = (target?.id ?? "").trim().toLowerCase();
  if (id === "") block("meta", operation, "target_missing");

  const esApp = target.kind === "app";

  // Identidades productivas vetadas fuera de producción, aunque alguien las
  // haya añadido a la allowlist por error.
  const produccion = readList(
    esApp ? "EGRESS_META_PRODUCTION_APP_IDS" : "EGRESS_META_PRODUCTION_ACCOUNT_IDS"
  );
  if (!isProduction() && produccion.includes(id)) {
    block("meta", operation, "production_target_from_non_production");
  }

  // Reconocimientos adicionales fuera de producción, análogos al delete de R2.
  if (!isProduction()) {
    if (
      (operation === "token_exchange" || operation === "credential_read") &&
      !flagIsTrue("EGRESS_META_ALLOW_CREDENTIAL_READ")
    ) {
      block("meta", operation, "credential_read_not_authorized");
    }
    if (
      (operation === "create_media" || operation === "publish") &&
      !flagIsTrue("EGRESS_META_ALLOW_PUBLISH")
    ) {
      block("meta", operation, "publish_not_authorized");
    }
  }

  const allowlist = readList(
    esApp ? "EGRESS_META_APP_ALLOWLIST" : "EGRESS_META_ACCOUNT_ALLOWLIST"
  ).map((entrada) => `${target.kind}:${entrada}`);

  assertEgressAllowedWithList(
    { channel: "meta", operation, target: `${target.kind}:${id}` },
    allowlist
  );
}

/**
 * Proveedores de inferencia reconocidos.
 *
 * Reconocer un proveedor aquí **no** lo autoriza: la autorización sigue siendo
 * el par exacto `proveedor:modelo` en `EGRESS_AI_TARGET_ALLOWLIST`. Esta unión
 * solo fija el vocabulario para que un typo (`"openia"`) no llegue a runtime.
 */
export type AiProvider = "anthropic" | "openai" | "ideogram" | "fal";

/** Operaciones semánticas del canal IA (subconjunto de `EgressOperation`). */
export type AiOperation = "analyze" | "generate_text" | "generate_image";

/**
 * Autoriza una llamada de inferencia a un proveedor de IA.
 *
 * Dos diferencias deliberadas frente al motor genérico:
 *
 *  1. **El destino es el par `proveedor:modelo`, y la lista se exige siempre**
 *     —también en modo `live` y también en producción—. Dos listas
 *     independientes (una de proveedores, otra de modelos) crearían un producto
 *     cartesiano: cualquier proveedor autorizado quedaría combinado con
 *     cualquier modelo autorizado. Con un solo par no hay combinación
 *     accidental, y estrenar un modelo nuevo exige una decisión explícita en vez
 *     de heredarse de que el proveedor ya estuviera habilitado.
 *
 *  2. **Fuera de producción hace falta un reconocimiento adicional**
 *     (`EGRESS_AI_ALLOW_INPUT_OUTSIDE_PRODUCTION`), análogo al `delete` de R2 y
 *     al `publish` de Meta: estas fronteras transportan sesiones de trabajo,
 *     briefs, propuestas y datos de clientes reales. Autorizar un modelo no es
 *     lo mismo que autorizar el envío de esa información desde un entorno de
 *     desarrollo.
 *
 * La comparación es exacta sobre el par normalizado: `anthropic:model-a` no
 * autoriza `anthropic:model-b` ni coincidencias parciales. El modelo que se
 * entrega al SDK no se altera — normalizar aquí es solo para decidir.
 */
export function assertAiEgressAllowed(input: {
  provider: AiProvider;
  model: string;
  operation: AiOperation;
}): void {
  const { provider, operation } = input;

  const mode = resolveMode("ai");
  if (mode === "invalid") block("ai", operation, "mode_invalid");
  if (mode === "disabled") block("ai", operation, "mode_disabled");

  const model = (input.model ?? "").trim().toLowerCase();
  if (model === "") block("ai", operation, "target_missing");

  const target = `${provider}:${model}`;
  const allowlist = readList("EGRESS_AI_TARGET_ALLOWLIST");
  if (allowlist.length === 0) block("ai", operation, "allowlist_empty");
  if (!allowlist.includes(target)) block("ai", operation, "target_not_allowed");

  // `live` conserva el mismo reconocimiento general que el resto de canales.
  if (mode === "live" && !isProduction() && !flagIsTrue("EGRESS_ALLOW_LIVE_OUTSIDE_PRODUCTION")) {
    block("ai", operation, "live_outside_production");
  }

  if (!isProduction() && !flagIsTrue("EGRESS_AI_ALLOW_INPUT_OUTSIDE_PRODUCTION")) {
    block("ai", operation, "input_not_authorized");
  }
}
