import { describe, expect, test, vi, beforeEach } from "vitest";

/**
 * submitSmilemoreQa — cuestionario público de levantamiento de Smile More.
 * Cubre el contrato de frontera: honeypot, validación, rate limit, filtrado
 * de claves desconocidas del jsonb, persistencia-antes-de-notificar y
 * saneamiento de lo que se persiste en system_alerts.
 */

const { logSystemAlertMock, enforceRateLimitMock, createResponseMock, sendWhatsAppMock } =
  vi.hoisted(() => ({
    logSystemAlertMock: vi.fn(),
    enforceRateLimitMock: vi.fn(),
    createResponseMock: vi.fn(),
    sendWhatsAppMock: vi.fn(async (_message: string) => undefined),
  }));

// `lib/email` instancia el cliente de Resend en el import — sin mock revienta.
vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(async () => ({ ok: true })),
  sendContactConfirmation: vi.fn(async () => ({ ok: true })),
  sendContactNotification: vi.fn(async () => ({ ok: true })),
  sendDiagnosticNotification: vi.fn(async () => ({ ok: true })),
  sendPasswordResetEmail: vi.fn(async () => ({ ok: true })),
  sendNewsletterWelcome: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/system-alerts", () => ({ logSystemAlert: logSystemAlertMock }));
vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: enforceRateLimitMock,
  formatRetryAfter: vi.fn(() => "1 minuto"),
}));
vi.mock("@/lib/leads-repo", () => ({
  createLead: vi.fn(),
  createDiagnosticLead: vi.fn(),
  updateLeadEmailDelivery: vi.fn(),
  markLeadWantsContact: vi.fn(),
}));
vi.mock("@/lib/newsletter-repo", () => ({
  subscribeOrReactivate: vi.fn(),
  normalizeEmail: vi.fn((e: string) => e.trim().toLowerCase()),
}));
vi.mock("@/lib/email-env-guard", () => ({ assertEmailEnv: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/lib/privacy", () => ({ hashIp: vi.fn(() => "hash") }));
vi.mock("@/lib/whatsapp/sender", () => ({ sendWhatsApp: sendWhatsAppMock }));
vi.mock("@/lib/db", () => ({ db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() } }));
vi.mock("@/lib/db/schema", () => ({
  clients: {},
  users: {},
  passwordResetTokens: {},
  leads: {},
  smilemoreQaResponses: {},
}));
vi.mock("@/lib/smilemore-qa-repo", () => ({
  createSmilemoreQaResponse: createResponseMock,
}));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ "x-forwarded-for": "203.0.113.9" })),
}));

import { submitSmilemoreQa, type SmilemoreQaFormInput } from "./actions";

const VALID_INPUT: SmilemoreQaFormInput = {
  nombre: "Dra. Prueba",
  puesto: "Doctor(a)",
  sucursal: "Guadalajara",
  uso: "Diario",
  respuestas: { "1_1": "El calendario se traba", clave_inventada: "no debería persistirse" },
  multiples: { "6_1": ["Celular"], otra_clave: ["x"] },
  modulos: {
    "2_1": { observacion: "Faltan campos", prioridad: "Alta" },
    modulo_falso: { observacion: "spam" },
  },
  incidencias: [{ seccion: "Agenda", ocurrio: "Se congeló", frecuencia: "A veces", impacto: "Alto" }],
  prioridades: [{ cambio: "Agenda más rápida", problema: "Lentitud", paraQuien: "Recepción" }],
};

beforeEach(() => {
  vi.clearAllMocks();
  enforceRateLimitMock.mockResolvedValue({ allowed: true });
  createResponseMock.mockResolvedValue("resp-uuid-1");
});

describe("submitSmilemoreQa", () => {
  test("honeypot lleno: no persiste, no notifica", async () => {
    const res = await submitSmilemoreQa({ ...VALID_INPUT, website: "spam-bot" });
    expect(res.ok).toBe(false);
    expect(createResponseMock).not.toHaveBeenCalled();
    expect(sendWhatsAppMock).not.toHaveBeenCalled();
  });

  test("nombre vacío: rechaza con errores de campo, sin tocar rate limit ni DB", async () => {
    const res = await submitSmilemoreQa({ ...VALID_INPUT, nombre: "" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors?.nombre).toBeTruthy();
    expect(enforceRateLimitMock).not.toHaveBeenCalled();
    expect(createResponseMock).not.toHaveBeenCalled();
  });

  test("rate limit excedido: rechaza sin persistir", async () => {
    enforceRateLimitMock.mockResolvedValue({ allowed: false, retryAfterSec: 60 });
    const res = await submitSmilemoreQa(VALID_INPUT);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toContain("Demasiados intentos");
    expect(createResponseMock).not.toHaveBeenCalled();
  });

  test("éxito: persiste solo claves conocidas y notifica por WhatsApp", async () => {
    const res = await submitSmilemoreQa(VALID_INPUT);
    expect(res).toEqual({ ok: true, responseId: "resp-uuid-1" });

    expect(createResponseMock).toHaveBeenCalledTimes(1);
    const saved = createResponseMock.mock.calls[0][0];
    expect(saved.respondentName).toBe("Dra. Prueba");
    expect(saved.branch).toBe("Guadalajara");
    expect(saved.ipHash).toBe("hash");
    // Claves fuera de la definición del cuestionario no llegan al jsonb.
    expect(saved.answers.respuestas).toEqual({ "1_1": "El calendario se traba" });
    expect(saved.answers.multiples).toEqual({ "6_1": ["Celular"] });
    expect(Object.keys(saved.answers.modulos)).toEqual(["2_1"]);
    expect(saved.answers.incidencias).toHaveLength(1);

    expect(sendWhatsAppMock).toHaveBeenCalledTimes(1);
    expect(String(sendWhatsAppMock.mock.calls[0][0])).toContain("Smile More");
  });

  test("fallo de WhatsApp no rompe el envío ya persistido", async () => {
    sendWhatsAppMock.mockRejectedValueOnce(new Error("allowlist"));
    const res = await submitSmilemoreQa(VALID_INPUT);
    expect(res.ok).toBe(true);
  });

  test("fallo de persistencia: mensaje genérico y alerta con código estable, sin error crudo", async () => {
    createResponseMock.mockRejectedValueOnce(
      new Error('insert into "smilemore_qa_responses" failed: password authentication')
    );
    const res = await submitSmilemoreQa(VALID_INPUT);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).not.toContain("password");

    expect(logSystemAlertMock).toHaveBeenCalledTimes(1);
    const alert = logSystemAlertMock.mock.calls[0][0];
    expect(alert.context).toEqual({ code: "smilemore_qa_create_failed" });
    expect(JSON.stringify(alert)).not.toContain("password authentication");
  });
});
