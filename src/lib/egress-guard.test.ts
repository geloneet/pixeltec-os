import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Gate E0a — validación de la política de salida.
 *
 * Dos niveles: el motor (`egress-guard`) y las cuatro fronteras reales (correo,
 * WhatsApp, VPS, R2). Para las fronteras lo que importa no es solo que lancen,
 * sino que **el cliente externo reciba cero invocaciones**: una guarda que
 * bloquea después del `fetch` no protege nada.
 *
 * Cero red real: Resend, `fetch` y el cliente de S3 están mockeados.
 */

// ── Mocks de clientes externos ────────────────────────────────────────────────

const resendSend = vi.fn(async () => ({ data: { id: "mock" }, error: null }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: resendSend };
  },
}));

const r2Send = vi.fn(async (_command?: unknown) => ({}));
vi.mock("@/lib/r2/client", () => ({
  r2: { send: (command: unknown) => r2Send(command) },
  getR2BucketName: () => process.env.__TEST_R2_BUCKET ?? "",
  getR2PublicUrl: (key: string) => `https://cdn.ejemplo.local/${key}`,
}));

const {
  assertEgressAllowed,
  assertEmailEgressAllowed,
  assertWhatsAppEgressAllowed,
  assertVpsEgressAllowed,
  assertR2EgressAllowed,
  EgressBlockedError,
  toE164,
} = await import("./egress-guard");

// ── Aislamiento de entorno ────────────────────────────────────────────────────

const ENV_ORIGINAL = { ...process.env };

/** Deja solo lo imprescindible: cualquier variable de política debe ser explícita. */
function limpiarEntorno() {
  for (const clave of Object.keys(process.env)) {
    if (clave.startsWith("EGRESS_") || clave === "VPS_API_URL" || clave === "__TEST_R2_BUCKET") {
      delete process.env[clave];
    }
  }
}

beforeEach(() => {
  limpiarEntorno();
  // `NODE_ENV` es de solo lectura en los tipos de Node; `stubEnv` la sustituye
  // sin romper el contrato de tipos y se revierte con `unstubAllEnvs`.
  vi.stubEnv("NODE_ENV", "test");
  resendSend.mockClear();
  r2Send.mockClear();
});

afterEach(() => {
  // Restauración total: ningún test puede filtrar política al siguiente.
  vi.unstubAllEnvs();
  for (const clave of Object.keys(process.env)) {
    if (!(clave in ENV_ORIGINAL)) delete process.env[clave];
  }
  Object.assign(process.env, ENV_ORIGINAL);
  vi.restoreAllMocks();
});

const pedir = (over: Partial<Parameters<typeof assertEgressAllowed>[0]> = {}) =>
  assertEgressAllowed({ channel: "email", operation: "send", ...over });

// ── 1. Motor de política ──────────────────────────────────────────────────────

describe("egress-guard — resolución de modo", () => {
  it("sin ninguna variable bloquea", () => {
    expect(() => pedir()).toThrow(EgressBlockedError);
  });

  it("default disabled bloquea", () => {
    process.env.EGRESS_DEFAULT_MODE = "disabled";
    expect(() => pedir()).toThrow(/mode_disabled/);
  });

  it("el override del canal tiene precedencia sobre el default", () => {
    process.env.EGRESS_DEFAULT_MODE = "disabled";
    process.env.EGRESS_EMAIL_MODE = "live";
    process.env.EGRESS_ALLOW_LIVE_OUTSIDE_PRODUCTION = "true";
    expect(() => pedir()).not.toThrow();
  });

  it("habilitar un canal no habilita otro", () => {
    process.env.EGRESS_EMAIL_MODE = "live";
    process.env.EGRESS_ALLOW_LIVE_OUTSIDE_PRODUCTION = "true";
    expect(() => pedir()).not.toThrow();
    expect(() => pedir({ channel: "r2", operation: "upload" })).toThrow(/mode_disabled/);
  });

  it("modo vacío bloquea y no cae al default", () => {
    process.env.EGRESS_DEFAULT_MODE = "live";
    process.env.EGRESS_ALLOW_LIVE_OUTSIDE_PRODUCTION = "true";
    process.env.EGRESS_EMAIL_MODE = "";
    expect(() => pedir()).toThrow(/mode_invalid/);
  });

  it("modo desconocido bloquea", () => {
    process.env.EGRESS_EMAIL_MODE = "enabled";
    expect(() => pedir()).toThrow(/mode_invalid/);
  });

  it("normaliza espacios y mayúsculas del modo", () => {
    process.env.EGRESS_EMAIL_MODE = "  LIVE  ";
    process.env.EGRESS_ALLOW_LIVE_OUTSIDE_PRODUCTION = "true";
    expect(() => pedir()).not.toThrow();
  });
});

describe("egress-guard — modo live", () => {
  it("en desarrollo sin reconocimiento bloquea", () => {
    process.env.EGRESS_EMAIL_MODE = "live";
    expect(() => pedir()).toThrow(/live_outside_production/);
  });

  it("en desarrollo con el valor exacto permite", () => {
    process.env.EGRESS_EMAIL_MODE = "live";
    process.env.EGRESS_ALLOW_LIVE_OUTSIDE_PRODUCTION = "true";
    expect(() => pedir()).not.toThrow();
  });

  it.each(["1", "yes", "enabled", "TRUE-ish", ""])(
    "el valor %o no autoriza live fuera de producción",
    (valor) => {
      process.env.EGRESS_EMAIL_MODE = "live";
      process.env.EGRESS_ALLOW_LIVE_OUTSIDE_PRODUCTION = valor;
      expect(() => pedir()).toThrow(/live_outside_production/);
    }
  );

  it("en producción permite sin reconocimiento adicional", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.EGRESS_EMAIL_MODE = "live";
    expect(() => pedir()).not.toThrow();
  });
});

describe("egress-guard — allowlist", () => {
  it("allowlist ausente bloquea", () => {
    process.env.EGRESS_EMAIL_MODE = "allowlist";
    expect(() => pedir({ target: "a@ejemplo.local" })).toThrow(/allowlist_empty/);
  });

  it("allowlist con solo espacios bloquea", () => {
    process.env.EGRESS_EMAIL_MODE = "allowlist";
    process.env.EGRESS_EMAIL_ALLOWLIST = "  ,  ";
    expect(() => pedir({ target: "a@ejemplo.local" })).toThrow(/allowlist_empty/);
  });

  it("target ausente bloquea", () => {
    process.env.EGRESS_EMAIL_MODE = "allowlist";
    process.env.EGRESS_EMAIL_ALLOWLIST = "a@ejemplo.local";
    expect(() => pedir()).toThrow(/target_missing/);
  });

  it("comparación exacta: un sufijo o prefijo no autoriza", () => {
    process.env.EGRESS_EMAIL_MODE = "allowlist";
    process.env.EGRESS_EMAIL_ALLOWLIST = "a@ejemplo.local";
    expect(() => pedir({ target: "a@ejemplo.local.otro.com" })).toThrow(/target_not_allowed/);
    expect(() => pedir({ target: "otro+a@ejemplo.local" })).toThrow(/target_not_allowed/);
  });
});

describe("egress-guard — forma del error", () => {
  it("es EgressBlockedError con code, canal, operación y razón, sin el target", () => {
    process.env.EGRESS_R2_MODE = "disabled";
    try {
      assertEgressAllowed({ channel: "r2", operation: "delete", target: "bucket-secreto" });
      throw new Error("debió lanzar");
    } catch (err) {
      expect(err).toBeInstanceOf(EgressBlockedError);
      const e = err as InstanceType<typeof EgressBlockedError>;
      expect(e.code).toBe("EGRESS_BLOCKED");
      expect(e.channel).toBe("r2");
      expect(e.operation).toBe("delete");
      expect(e.reason).toBe("mode_disabled");
      expect(e.message).not.toContain("bucket-secreto");
    }
  });
});

// ── 2. Frontera de correo ─────────────────────────────────────────────────────

describe("frontera de correo", () => {
  const permitir = () => {
    process.env.EGRESS_EMAIL_MODE = "allowlist";
    process.env.EGRESS_EMAIL_ALLOWLIST = "permitido@ejemplo.local";
  };

  it("destinatario autorizado pasa la guarda", () => {
    permitir();
    expect(() => assertEmailEgressAllowed({ to: "permitido@ejemplo.local" })).not.toThrow();
  });

  it("normaliza mayúsculas y espacios", () => {
    permitir();
    expect(() => assertEmailEgressAllowed({ to: "  PERMITIDO@Ejemplo.Local " })).not.toThrow();
  });

  it("destinatario no autorizado bloquea", () => {
    permitir();
    expect(() => assertEmailEgressAllowed({ to: "otro@ejemplo.local" })).toThrow(
      /target_not_allowed/
    );
  });

  it("CC no autorizado bloquea el envío completo", () => {
    permitir();
    expect(() =>
      assertEmailEgressAllowed({ to: "permitido@ejemplo.local", cc: "fuera@ejemplo.local" })
    ).toThrow(/target_not_allowed/);
  });

  it("BCC no autorizado bloquea el envío completo", () => {
    permitir();
    expect(() =>
      assertEmailEgressAllowed({ to: "permitido@ejemplo.local", bcc: ["fuera@ejemplo.local"] })
    ).toThrow(/target_not_allowed/);
  });

  it("dirección sintácticamente inválida bloquea", () => {
    permitir();
    expect(() => assertEmailEgressAllowed({ to: "no-es-correo" })).toThrow(/target_invalid/);
  });

  it("sin destinatarios bloquea", () => {
    permitir();
    expect(() => assertEmailEgressAllowed({})).toThrow(/target_missing/);
  });

  it("al bloquear, resend.emails.send recibe CERO llamadas", async () => {
    const spyErr = vi.spyOn(console, "error").mockImplementation(() => {});
    const { sendEmail } = await import("./email");
    const res = await sendEmail("nadie@ejemplo.local", "asunto", "<p>x</p>");
    expect(res.success).toBe(false);
    expect(res.error).toBe("EGRESS_BLOCKED");
    expect(resendSend).not.toHaveBeenCalled();
    expect(spyErr).toHaveBeenCalled();
  });

  it("con destinatario autorizado sí invoca a Resend", async () => {
    permitir();
    const { sendEmail } = await import("./email");
    await sendEmail("permitido@ejemplo.local", "asunto", "<p>x</p>");
    expect(resendSend).toHaveBeenCalledOnce();
  });
});

// ── 3. Frontera de WhatsApp ───────────────────────────────────────────────────

describe("frontera de WhatsApp", () => {
  const permitir = () => {
    process.env.EGRESS_WHATSAPP_MODE = "allowlist";
    process.env.EGRESS_WHATSAPP_ALLOWLIST = "+5215550000000";
  };

  it("normaliza a E.164 solo para autorizar", () => {
    expect(toE164("+52 155-5000 0000")).toBe("+5215550000000");
    expect(toE164("5215550000000")).toBe("+5215550000000");
    expect(toE164("(521) 555 000 0000")).toBe("+5215550000000");
  });

  it("acepta el número allowlisted con separadores", () => {
    permitir();
    expect(() => assertWhatsAppEgressAllowed("+52 155-5000 0000")).not.toThrow();
  });

  it("número distinto bloquea", () => {
    permitir();
    expect(() => assertWhatsAppEgressAllowed("+5215550000001")).toThrow(/target_not_allowed/);
  });

  it("coincidencia parcial bloquea", () => {
    permitir();
    expect(() => assertWhatsAppEgressAllowed("+521555000000")).toThrow(/target_not_allowed/);
  });

  it("número inválido bloquea", () => {
    permitir();
    expect(() => assertWhatsAppEgressAllowed("abc")).toThrow(/target_invalid/);
    expect(() => assertWhatsAppEgressAllowed("")).toThrow(/target_invalid/);
  });

  it("allowlist vacía bloquea", () => {
    process.env.EGRESS_WHATSAPP_MODE = "allowlist";
    expect(() => assertWhatsAppEgressAllowed("+5215550000000")).toThrow(/allowlist_empty/);
  });
});

// ── 4. Frontera de VPS ────────────────────────────────────────────────────────

describe("frontera de VPS", () => {
  const permitirHost = (hosts: string) => {
    process.env.EGRESS_VPS_MODE = "allowlist";
    process.env.EGRESS_VPS_HOST_ALLOWLIST = hosts;
  };

  it("URL ausente bloquea", () => {
    permitirHost("localhost");
    expect(() => assertVpsEgressAllowed(undefined, "read")).toThrow(/target_missing/);
    expect(() => assertVpsEgressAllowed("   ", "read")).toThrow(/target_missing/);
  });

  it("URL inválida bloquea", () => {
    permitirHost("localhost");
    expect(() => assertVpsEgressAllowed("no-es-url", "read")).toThrow(/target_invalid/);
  });

  it("URL con credenciales embebidas bloquea", () => {
    permitirHost("vps-dev.ejemplo.local");
    expect(() =>
      assertVpsEgressAllowed("https://usuario:clave@vps-dev.ejemplo.local", "deploy")
    ).toThrow(/target_invalid/);
  });

  it("el host productivo bloquea fuera de producción aunque esté en la allowlist", () => {
    permitirHost("api.pixeltec.mx");
    expect(() => assertVpsEgressAllowed("https://api.pixeltec.mx", "restart")).toThrow(
      /production_target_from_non_production/
    );
  });

  it("host remoto por HTTP bloquea", () => {
    permitirHost("vps-dev.ejemplo.local");
    expect(() => assertVpsEgressAllowed("http://vps-dev.ejemplo.local", "read")).toThrow(
      /target_invalid/
    );
  });

  it("HTTP en loopback se permite", () => {
    permitirHost("127.0.0.1");
    expect(() => assertVpsEgressAllowed("http://127.0.0.1:9999", "read")).not.toThrow();
  });

  it("HTTPS a host DEV allowlisted se permite", () => {
    permitirHost("vps-dev.ejemplo.local");
    expect(() => assertVpsEgressAllowed("https://vps-dev.ejemplo.local", "deploy")).not.toThrow();
  });

  it("host no allowlisted bloquea", () => {
    permitirHost("vps-dev.ejemplo.local");
    expect(() => assertVpsEgressAllowed("https://otro.ejemplo.local", "read")).toThrow(
      /target_not_allowed/
    );
  });

  it("al bloquear, fetch recibe CERO llamadas", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    process.env.VPS_API_SECRET = "irrelevante-para-el-test";
    process.env.VPS_API_URL = "https://api.pixeltec.mx";
    const { fetchVpsApi } = await import("./vpsClient");
    await expect(fetchVpsApi("/deploy")).rejects.toThrow(/EGRESS_BLOCKED/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sin VPS_API_URL bloquea antes de cualquier red", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    process.env.VPS_API_SECRET = "irrelevante-para-el-test";
    const { fetchVpsApi } = await import("./vpsClient");
    await expect(fetchVpsApi("/status")).rejects.toThrow(/EGRESS_BLOCKED/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ── 5. Frontera de R2 ─────────────────────────────────────────────────────────

describe("frontera de R2", () => {
  const permitirBucket = (bucket: string) => {
    process.env.EGRESS_R2_MODE = "allowlist";
    process.env.EGRESS_R2_BUCKET_ALLOWLIST = bucket;
    process.env.__TEST_R2_BUCKET = bucket;
  };

  it("upload a bucket allowlisted pasa la guarda", () => {
    permitirBucket("pixeltec-dev");
    expect(() => assertR2EgressAllowed("pixeltec-dev", "upload")).not.toThrow();
  });

  it("bucket distinto bloquea", () => {
    permitirBucket("pixeltec-dev");
    expect(() => assertR2EgressAllowed("pixeltec-prod", "upload")).toThrow(/target_not_allowed/);
  });

  it("coincidencia parcial bloquea", () => {
    permitirBucket("pixeltec-dev");
    expect(() => assertR2EgressAllowed("pixeltec-dev-2", "upload")).toThrow(/target_not_allowed/);
  });

  it("bucket vacío bloquea", () => {
    permitirBucket("pixeltec-dev");
    expect(() => assertR2EgressAllowed("", "upload")).toThrow(/target_missing/);
  });

  it("bucket productivo bloquea fuera de producción aunque esté allowlisted", () => {
    permitirBucket("pixeltec-prod");
    process.env.EGRESS_R2_PRODUCTION_BUCKETS = "pixeltec-prod";
    expect(() => assertR2EgressAllowed("pixeltec-prod", "upload")).toThrow(
      /production_target_from_non_production/
    );
  });

  it("delete sin autorización explícita bloquea", () => {
    permitirBucket("pixeltec-dev");
    expect(() => assertR2EgressAllowed("pixeltec-dev", "delete")).toThrow(/delete_not_authorized/);
  });

  it.each(["1", "yes", "enabled"])("el valor %o no autoriza delete", (valor) => {
    permitirBucket("pixeltec-dev");
    process.env.EGRESS_R2_ALLOW_DELETE = valor;
    expect(() => assertR2EgressAllowed("pixeltec-dev", "delete")).toThrow(/delete_not_authorized/);
  });

  it("delete con autorización exacta pasa", () => {
    permitirBucket("pixeltec-dev");
    process.env.EGRESS_R2_ALLOW_DELETE = "true";
    expect(() => assertR2EgressAllowed("pixeltec-dev", "delete")).not.toThrow();
  });

  it("al bloquear upload, el cliente S3 recibe CERO llamadas", async () => {
    process.env.__TEST_R2_BUCKET = "pixeltec-prod";
    const { uploadObject } = await import("./r2/upload");
    await expect(uploadObject("k", Buffer.from("x"), "text/plain")).rejects.toThrow(
      /EGRESS_BLOCKED/
    );
    expect(r2Send).not.toHaveBeenCalled();
  });

  it("al bloquear delete, el cliente S3 recibe CERO llamadas", async () => {
    permitirBucket("pixeltec-dev");
    const { deleteObject } = await import("./r2/upload");
    await expect(deleteObject("k")).rejects.toThrow(/EGRESS_BLOCKED/);
    expect(r2Send).not.toHaveBeenCalled();
  });
});
