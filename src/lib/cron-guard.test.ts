import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Gate E0d — política de ejecución de trabajos programados.
 *
 * Dos niveles: el núcleo (`cron-guard`) y las siete rutas reales. En las rutas
 * lo que importa no es solo el 503, sino que **el trabajo no empiece**: las
 * dependencias aguas abajo deben recibir cero llamadas, porque varias rutas
 * cargan usuarios y recorren lotes antes de llegar a las fronteras de egress.
 *
 * También se fija el orden de los controles: sin secreto siempre se recibe 401,
 * nunca 503 — un llamador no autenticado no debe aprender si el cron está
 * activo.
 */

const SECRETO = "secreto-cron-sintetico";

// ── Dobles de las dependencias aguas abajo ────────────────────────────────────

const sendWhatsApp = vi.fn(async () => ({ ok: true }));
const sendEmail = vi.fn(async () => ({ success: true }));
const publishScheduledPosts = vi.fn(async () => ({ published: 0 }));
const checkEmailEnv = vi.fn(() => ({ ok: true }));
const dbSelect = vi.fn(() => ({ from: () => [] }));

vi.mock("@/lib/whatsapp/sender", () => ({ sendWhatsApp: () => sendWhatsApp() }));
vi.mock("@/lib/email", () => ({ sendEmail: () => sendEmail() }));
vi.mock("@/lib/growth/social/publish", () => ({
  publishScheduledPosts: () => publishScheduledPosts(),
}));
vi.mock("@/lib/email-env-guard", () => ({ checkEmailEnv: () => checkEmailEnv() }));
vi.mock("@/lib/db", () => ({ db: { select: () => dbSelect() } }));
// `charges` y `daily` importan estos módulos, que arrastran next-auth y con él
// `next/server`, irresoluble en el entorno node de vitest. Se sustituyen para
// que el test mida la guarda y no la cadena de dependencias de la aplicación.
const createNotification = vi.fn(async () => undefined);
const getFullCrmData = vi.fn(async () => ({ clients: [] }));
vi.mock("@/lib/notifications/create", () => ({
  createNotification: () => createNotification(),
}));
vi.mock("@/lib/db/repos/crm-sync", () => ({ getFullCrmData: () => getFullCrmData() }));

const { assertCronExecutionAllowed, cronBlockedResponse, CronExecutionBlockedError } =
  await import("./cron-guard");

const ENV_ORIGINAL = { ...process.env };

beforeEach(() => {
  for (const clave of Object.keys(process.env)) {
    if (clave.startsWith("CRON_")) delete process.env[clave];
  }
  vi.stubEnv("NODE_ENV", "test");
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
  for (const clave of Object.keys(process.env)) {
    if (!(clave in ENV_ORIGINAL)) delete process.env[clave];
  }
  Object.assign(process.env, ENV_ORIGINAL);
  vi.restoreAllMocks();
});

// ── 1. Núcleo ─────────────────────────────────────────────────────────────────

describe("cron-guard — núcleo", () => {
  it("sin variables bloquea", () => {
    expect(() => assertCronExecutionAllowed()).toThrow(CronExecutionBlockedError);
  });

  it("disabled bloquea", () => {
    process.env.CRON_EXECUTION_MODE = "disabled";
    expect(() => assertCronExecutionAllowed()).toThrow(/mode_disabled/);
  });

  it("valor vacío bloquea como inválido", () => {
    process.env.CRON_EXECUTION_MODE = "";
    expect(() => assertCronExecutionAllowed()).toThrow(/mode_invalid/);
  });

  it("valor desconocido bloquea como inválido", () => {
    process.env.CRON_EXECUTION_MODE = "on";
    expect(() => assertCronExecutionAllowed()).toThrow(/mode_invalid/);
  });

  it("enabled en desarrollo sin reconocimiento bloquea", () => {
    process.env.CRON_EXECUTION_MODE = "enabled";
    expect(() => assertCronExecutionAllowed()).toThrow(/enabled_outside_production/);
  });

  it("enabled en desarrollo con true exacto permite", () => {
    process.env.CRON_EXECUTION_MODE = "enabled";
    process.env.CRON_ALLOW_OUTSIDE_PRODUCTION = "true";
    expect(() => assertCronExecutionAllowed()).not.toThrow();
  });

  it.each(["1", "yes", "enabled", "TRUE-ish"])("el valor %o no autoriza", (valor) => {
    process.env.CRON_EXECUTION_MODE = "enabled";
    process.env.CRON_ALLOW_OUTSIDE_PRODUCTION = valor;
    expect(() => assertCronExecutionAllowed()).toThrow(/enabled_outside_production/);
  });

  it("enabled en producción permite sin reconocimiento", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.CRON_EXECUTION_MODE = "enabled";
    expect(() => assertCronExecutionAllowed()).not.toThrow();
  });

  it("conocer CRON_SECRET no habilita el cron", () => {
    process.env.CRON_SECRET = SECRETO;
    expect(() => assertCronExecutionAllowed()).toThrow(/mode_disabled/);
  });

  it("el error es estable y no lleva configuración", () => {
    process.env.CRON_EXECUTION_MODE = "disabled";
    process.env.CRON_SECRET = SECRETO;
    try {
      assertCronExecutionAllowed();
      throw new Error("debió lanzar");
    } catch (err) {
      const e = err as InstanceType<typeof CronExecutionBlockedError>;
      expect(e).toBeInstanceOf(CronExecutionBlockedError);
      expect(e.code).toBe("CRON_EXECUTION_BLOCKED");
      expect(e.reason).toBe("mode_disabled");
      expect(e.message).not.toContain(SECRETO);
    }
  });

  it("cronBlockedResponse traduce solo su error y devuelve 503 sanitizado", async () => {
    const res = cronBlockedResponse(new CronExecutionBlockedError("mode_disabled"));
    expect(res?.status).toBe(503);
    await expect(res?.json()).resolves.toEqual({ error: "CRON_EXECUTION_BLOCKED" });
    // Cualquier otro error debe propagarse, no enmascararse.
    expect(cronBlockedResponse(new Error("fallo real"))).toBeNull();
  });
});

// ── 2. Las siete rutas ────────────────────────────────────────────────────────

/** Rutas con su módulo, método, forma de credencial y efecto que deben evitar. */
const RUTAS = [
  {
    nombre: "notifications/charges",
    mod: () => import("@/app/api/notifications/charges/route"),
    metodo: "GET" as const,
    bearer: false,
    efecto: () => sendWhatsApp,
  },
  {
    nombre: "notifications/daily",
    mod: () => import("@/app/api/notifications/daily/route"),
    metodo: "GET" as const,
    bearer: false,
    efecto: () => sendWhatsApp,
  },
  {
    nombre: "notifications/send",
    mod: () => import("@/app/api/notifications/send/route"),
    metodo: "POST" as const,
    bearer: true,
    efecto: () => sendWhatsApp,
  },
  {
    nombre: "notifications/test",
    mod: () => import("@/app/api/notifications/test/route"),
    metodo: "GET" as const,
    bearer: false,
    efecto: () => sendWhatsApp,
  },
  {
    nombre: "whatsapp/send-test",
    mod: () => import("@/app/api/whatsapp/send-test/route"),
    metodo: "POST" as const,
    bearer: true,
    efecto: () => sendWhatsApp,
  },
  {
    nombre: "growth/publish/scheduled",
    mod: () => import("@/app/api/growth/publish/scheduled/route"),
    metodo: "POST" as const,
    bearer: true,
    efecto: () => publishScheduledPosts,
  },
  {
    nombre: "health/email",
    mod: () => import("@/app/api/health/email/route"),
    metodo: "GET" as const,
    bearer: true,
    efecto: () => checkEmailEnv,
  },
];

type RouteHandler = (r: Request) => Promise<Response>;

/**
 * Cada ruta exporta solo su método (GET o POST), así que el módulo no admite
 * indexación por la unión. Se normaliza aquí en vez de repetir el cast.
 */
async function obtenerHandler(
  mod: () => Promise<unknown>,
  metodo: "GET" | "POST"
): Promise<RouteHandler> {
  const modulo = (await mod()) as Record<string, RouteHandler | undefined>;
  const handler = modulo[metodo];
  if (!handler) throw new Error(`la ruta no exporta ${metodo}`);
  return handler;
}

/** Petición con o sin credencial válida, según la forma que acepte la ruta. */
function peticion(bearer: boolean, valida: boolean) {
  const url =
    valida && !bearer ? `https://local.test/?secret=${SECRETO}` : "https://local.test/";
  const headers: Record<string, string> = {
    authorization: valida ? `Bearer ${SECRETO}` : "Bearer incorrecto",
  };
  return new Request(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ message: "x" }),
  });
}

describe.each(RUTAS)("ruta $nombre", ({ mod, metodo, bearer, efecto }) => {
  beforeEach(() => {
    process.env.CRON_SECRET = SECRETO;
  });

  it("secreto inválido devuelve 401 aunque el cron esté habilitado", async () => {
    process.env.CRON_EXECUTION_MODE = "enabled";
    process.env.CRON_ALLOW_OUTSIDE_PRODUCTION = "true";
    const handler = await obtenerHandler(mod, metodo);
    const res = await handler(peticion(bearer, false));
    expect(res.status).toBe(401);
    expect(efecto()).not.toHaveBeenCalled();
  });

  it("secreto válido con cron deshabilitado devuelve 503 y cero efectos", async () => {
    const handler = await obtenerHandler(mod, metodo);
    const res = await handler(peticion(bearer, true));
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ error: "CRON_EXECUTION_BLOCKED" });
    expect(efecto()).not.toHaveBeenCalled();
    expect(dbSelect).not.toHaveBeenCalled();
  });

  it("modo inválido también bloquea con 503", async () => {
    process.env.CRON_EXECUTION_MODE = "quizas";
    const handler = await obtenerHandler(mod, metodo);
    const res = await handler(peticion(bearer, true));
    expect(res.status).toBe(503);
    expect(efecto()).not.toHaveBeenCalled();
  });

  it("habilitado de forma controlada deja pasar la guarda", async () => {
    process.env.CRON_EXECUTION_MODE = "enabled";
    process.env.CRON_ALLOW_OUTSIDE_PRODUCTION = "true";
    const handler = await obtenerHandler(mod, metodo);
    const res = await handler(peticion(bearer, true));
    // El trabajo puede fallar por otras razones en este entorno, pero lo que se
    // fija aquí es que la guarda ya no lo detiene.
    expect(res.status).not.toBe(503);
  });
});

// ── 3. Capas independientes ───────────────────────────────────────────────────

describe("cron y egress son capas distintas", () => {
  it("habilitar el cron no altera ni interpreta los modos de egress", async () => {
    process.env.CRON_EXECUTION_MODE = "enabled";
    process.env.CRON_ALLOW_OUTSIDE_PRODUCTION = "true";
    expect(() => assertCronExecutionAllowed()).not.toThrow();

    // La política de Meta sigue decidiendo por su cuenta.
    const { assertEgressAllowed } = await import("@/lib/egress-guard");
    expect(() => assertEgressAllowed({ channel: "meta", operation: "publish" })).toThrow(
      /mode_disabled/
    );
    expect(process.env.EGRESS_META_MODE).toBeUndefined();
  });
});
