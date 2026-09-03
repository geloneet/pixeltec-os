/**
 * Validador del contrato de configuración de egress E0 (E0g-1).
 *
 * Valida NOMBRES y semántica de las 28 variables de política + el requisito
 * del secreto CRON_SECRET, sin imprimir jamás un valor: la salida solo lleva
 * canal, variable y estado (present | missing | invalid | forbidden). No toca
 * el VPS, no modifica `.env`, no reinicia nada — es lectura pura del entorno
 * del proceso (o del objeto que se le inyecte en tests).
 *
 * Dos perfiles:
 *   - dev       (default): todo ausente es VÁLIDO — fail-closed es el estado
 *                natural de desarrollo. Solo se reportan valores inválidos y
 *                configuraciones que el guard bloquearía por incoherentes
 *                (live sin flag fuera de producción, allowlist vacía).
 *   - predeploy: contrato de producción — los 8 modos explícitos (Unsplash y Google son opcionales), allowlists
 *                exigidas por el modo elegido, flags *_OUTSIDE_PRODUCTION
 *                ausentes, EGRESS_DEFAULT_MODE ausente (producción no usa el
 *                atajo global) y CRON_SECRET presente (secreto, no política).
 *
 * Mínimo privilegio: activar un canal NO implica autorizar sus capacidades
 * sensibles (borrado R2, lectura de credenciales Meta, publicación Meta).
 * Esas tres solo se exigen si el despliegue las declara explícitamente
 * (RequiredCapabilities / flags del CLI); ausentes = capacidad bloqueada, y
 * eso es un estado válido de producción.
 *
 * Uso: npm run validate:egress [-- --profile=predeploy]
 *        [--require-r2-delete] [--require-meta-credential-read] [--require-meta-publish]
 * Exit code 1 ante cualquier missing/invalid/forbidden.
 */

export type Profile = "dev" | "predeploy";
export type VarStatus = "present" | "missing" | "invalid" | "forbidden";

export interface Finding {
  channel: string;
  name: string;
  status: VarStatus;
  /** Motivo estable, sin valores. */
  note?: string;
}

export interface ValidationResult {
  profile: Profile;
  findings: Finding[];
  /** true si no hay missing/invalid/forbidden. */
  ok: boolean;
}

type Env = Record<string, string | undefined>;

const EGRESS_MODES = new Set(["disabled", "allowlist", "live"]);
const CRON_MODES = new Set(["disabled", "enabled"]);

/** Canales EGRESS con su variable de modo y (si aplica) allowlists exigibles.
 *  `optional: true` = el predeploy no exige el modo (ausente ⇒ disabled). */
const CHANNELS: Array<{ channel: string; mode: string; allowlists: string[]; optional?: boolean }> = [
  { channel: "email", mode: "EGRESS_EMAIL_MODE", allowlists: ["EGRESS_EMAIL_ALLOWLIST"] },
  { channel: "whatsapp", mode: "EGRESS_WHATSAPP_MODE", allowlists: ["EGRESS_WHATSAPP_ALLOWLIST"] },
  { channel: "vps", mode: "EGRESS_VPS_MODE", allowlists: ["EGRESS_VPS_HOST_ALLOWLIST"] },
  { channel: "r2", mode: "EGRESS_R2_MODE", allowlists: ["EGRESS_R2_BUCKET_ALLOWLIST"] },
  {
    channel: "meta",
    mode: "EGRESS_META_MODE",
    allowlists: ["EGRESS_META_APP_ALLOWLIST", "EGRESS_META_ACCOUNT_ALLOWLIST"],
  },
  { channel: "ai", mode: "EGRESS_AI_MODE", allowlists: [] },
  { channel: "internal", mode: "EGRESS_INTERNAL_MODE", allowlists: [] },
  // Canal OPCIONAL del contrato: ausente = disabled (fail-closed en runtime)
  // y el predeploy NO lo exige — se activa cuando producción declare
  // EGRESS_UNSPLASH_MODE=live + UNSPLASH_ACCESS_KEY.
  { channel: "unsplash", mode: "EGRESS_UNSPLASH_MODE", allowlists: [], optional: true },
  // Google Search Console (WO-2026-00214). También OPCIONAL: hasta que
  // producción declare EGRESS_GOOGLE_MODE=live + GOOGLE_SERVICE_ACCOUNT_JSON,
  // ausente = disabled es el estado CORRECTO, no una omisión.
  { channel: "google", mode: "EGRESS_GOOGLE_MODE", allowlists: [], optional: true },
];

/** Solo "true" activa (mismo parseo que flagIsTrue del guard). */
const OUTSIDE_PRODUCTION_FLAGS: Array<{ channel: string; name: string }> = [
  { channel: "global", name: "EGRESS_ALLOW_LIVE_OUTSIDE_PRODUCTION" },
  { channel: "ai", name: "EGRESS_AI_ALLOW_INPUT_OUTSIDE_PRODUCTION" },
  { channel: "internal", name: "EGRESS_INTERNAL_ALLOW_SEND_OUTSIDE_PRODUCTION" },
  { channel: "cron", name: "CRON_ALLOW_OUTSIDE_PRODUCTION" },
];

/** Capacidades sensibles que un despliegue puede declarar como requeridas. */
export type RequiredCapabilities = {
  r2Delete?: boolean;
  metaCredentialRead?: boolean;
  metaPublish?: boolean;
};

/**
 * Flags de capacidad — mínimo privilegio: NUNCA se exigen por tener el canal
 * activo; solo cuando el despliegue declara la capacidad. Presentes, se
 * validan como booleanos estrictos (solo "true" habilita).
 */
const CAPABILITY_FLAGS: Array<{
  channel: string;
  name: string;
  cap: keyof RequiredCapabilities;
  note: string;
}> = [
  { channel: "r2", name: "EGRESS_R2_ALLOW_DELETE", cap: "r2Delete", note: "capacidad declarada: los deletes de R2 exigen true" },
  { channel: "meta", name: "EGRESS_META_ALLOW_CREDENTIAL_READ", cap: "metaCredentialRead", note: "capacidad declarada: leer credenciales Meta exige true" },
  { channel: "meta", name: "EGRESS_META_ALLOW_PUBLISH", cap: "metaPublish", note: "capacidad declarada: publicar en Meta exige true" },
];

function defined(env: Env, name: string): boolean {
  const raw = env[name];
  return typeof raw === "string" && raw.trim() !== "";
}

function normalized(env: Env, name: string): string | undefined {
  const raw = env[name];
  if (typeof raw !== "string" || raw.trim() === "") return undefined;
  return raw.trim().toLowerCase();
}

/** Un booleano del contrato es sano si está ausente/vacío o vale exactamente "true". */
function boolInvalid(env: Env, name: string): boolean {
  const value = normalized(env, name);
  return value !== undefined && value !== "true";
}

export function validateEgressConfig(
  env: Env,
  profile: Profile,
  caps: RequiredCapabilities = {}
): ValidationResult {
  const findings: Finding[] = [];
  const add = (channel: string, name: string, status: VarStatus, note?: string) =>
    findings.push({ channel, name, status, note });

  // ── EGRESS_DEFAULT_MODE ──────────────────────────────────────────────────
  const defaultMode = normalized(env, "EGRESS_DEFAULT_MODE");
  if (defined(env, "EGRESS_DEFAULT_MODE") && (defaultMode === undefined || !EGRESS_MODES.has(defaultMode))) {
    add("global", "EGRESS_DEFAULT_MODE", "invalid", "modo no reconocido");
  } else if (profile === "predeploy" && defined(env, "EGRESS_DEFAULT_MODE")) {
    add("global", "EGRESS_DEFAULT_MODE", "forbidden", "producción declara cada canal explícitamente");
  }

  // ── Modos por canal + allowlists ─────────────────────────────────────────
  for (const { channel, mode, allowlists, optional } of CHANNELS) {
    const value = normalized(env, mode);

    if (defined(env, mode) && (value === undefined || !EGRESS_MODES.has(value))) {
      add(channel, mode, "invalid", "modo no reconocido; el guard bloquea");
      continue;
    }

    if (!defined(env, mode)) {
      if (profile === "predeploy" && !optional) {
        add(channel, mode, "missing", "producción exige modo explícito");
      }
      continue; // ausente = disabled (fail-closed), correcto por diseño.
    }

    add(channel, mode, "present");

    // live fuera de producción queda bloqueado por el guard salvo el flag.
    if (
      profile === "dev" &&
      value === "live" &&
      normalized(env, "EGRESS_ALLOW_LIVE_OUTSIDE_PRODUCTION") !== "true"
    ) {
      add(channel, mode, "invalid", "live fuera de producción queda bloqueado sin el flag global");
    }

    // Allowlists exigidas por el modo elegido.
    if (value === "allowlist") {
      for (const listName of allowlists) {
        if (!defined(env, listName)) {
          add(channel, listName, "missing", "el modo allowlist exige lista no vacía");
        }
      }
    }
  }

  // ── Allowlists que se exigen SIEMPRE que el canal esté activo ────────────
  const aiMode = normalized(env, "EGRESS_AI_MODE");
  const aiActive = aiMode === "allowlist" || aiMode === "live";
  if ((profile === "predeploy" || aiActive) && !defined(env, "EGRESS_AI_TARGET_ALLOWLIST")) {
    add("ai", "EGRESS_AI_TARGET_ALLOWLIST", "missing", "se exige siempre, también en live");
  }

  const internalMode = normalized(env, "EGRESS_INTERNAL_MODE");
  const internalActive = internalMode === "allowlist" || internalMode === "live";
  if ((profile === "predeploy" || internalActive) && !defined(env, "EGRESS_INTERNAL_TARGET_ALLOWLIST")) {
    add("internal", "EGRESS_INTERNAL_TARGET_ALLOWLIST", "missing", "se exige siempre, también en live");
  }

  // ── Flags de capacidad (mínimo privilegio) ───────────────────────────────
  // Activar un canal NO exige estas variables: ausentes = capacidad bloqueada,
  // estado válido en producción. Solo se exigen si el despliegue las declara.
  for (const { channel, name, cap, note } of CAPABILITY_FLAGS) {
    if (boolInvalid(env, name)) {
      add(channel, name, "invalid", 'solo "true" activa; otro valor es ruido de configuración');
      continue;
    }
    if (caps[cap] && normalized(env, name) !== "true") {
      add(channel, name, "missing", note);
    }
  }

  // ── Flags *_OUTSIDE_PRODUCTION ───────────────────────────────────────────
  for (const { channel, name } of OUTSIDE_PRODUCTION_FLAGS) {
    if (profile === "predeploy") {
      if (defined(env, name)) {
        add(channel, name, "forbidden", "en producción debe permanecer ausente (ni siquiera false)");
      }
    } else if (boolInvalid(env, name)) {
      add(channel, name, "invalid", 'solo "true" activa; otro valor es ruido de configuración');
    }
  }

  // ── Cron ─────────────────────────────────────────────────────────────────
  const cronMode = normalized(env, "CRON_EXECUTION_MODE");
  if (defined(env, "CRON_EXECUTION_MODE") && (cronMode === undefined || !CRON_MODES.has(cronMode))) {
    add("cron", "CRON_EXECUTION_MODE", "invalid", "valores: disabled | enabled");
  } else if (!defined(env, "CRON_EXECUTION_MODE")) {
    if (profile === "predeploy") add("cron", "CRON_EXECUTION_MODE", "missing", "producción exige modo explícito");
  } else {
    add("cron", "CRON_EXECUTION_MODE", "present");
  }

  // CRON_SECRET: requisito de SECRETO operativo, separado de la política.
  if (profile === "predeploy" && !defined(env, "CRON_SECRET")) {
    add("cron", "CRON_SECRET", "missing", "secreto operativo requerido (no es variable de política)");
  }

  const ok = findings.every((f) => f.status === "present");
  return { profile, findings, ok };
}

/** Render sin valores: canal, variable, estado y nota. */
export function renderFindings(result: ValidationResult): string {
  const lines = result.findings.map(
    (f) => `${f.status.toUpperCase().padEnd(9)} ${f.channel.padEnd(8)} ${f.name}${f.note ? ` — ${f.note}` : ""}`
  );
  lines.push(
    result.ok
      ? `OK — contrato E0 válido (perfil ${result.profile})`
      : `FAIL — contrato E0 inválido (perfil ${result.profile})`
  );
  return lines.join("\n");
}

// ── CLI ─────────────────────────────────────────────────────────────────────
const invokedDirectly = process.argv[1]?.endsWith("validate-egress-config.ts");
if (invokedDirectly) {
  const profile: Profile = process.argv.includes("--profile=predeploy") ? "predeploy" : "dev";
  // Capacidades declaradas por el despliegue — nunca por defecto (mínimo privilegio).
  const caps: RequiredCapabilities = {
    r2Delete: process.argv.includes("--require-r2-delete"),
    metaCredentialRead: process.argv.includes("--require-meta-credential-read"),
    metaPublish: process.argv.includes("--require-meta-publish"),
  };
  const result = validateEgressConfig(process.env as Env, profile, caps);
  console.log(renderFindings(result));
  process.exit(result.ok ? 0 : 1);
}
