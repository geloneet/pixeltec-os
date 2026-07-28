import { describe, expect, test, vi, beforeEach } from "vitest";

/**
 * Saneamiento de lo que se PERSISTE en `system_alerts` — los 3 puntos de G-04
 * de este archivo (E0f-3a).
 *
 * Aquí el visitante siempre recibió un texto genérico nuestro, así que no había
 * fuga hacia el cliente. La que sí había era hacia la base: `context` es una
 * columna jsonb y guardaba la conversión a texto del error, con el SQL de
 * Drizzle y el stack dentro. La tabla no tiene lectores hoy, pero lo que se
 * escribe queda —y el día que alguien construya un panel de alertas, se
 * convierte en fuga reflejada.
 */

const { logSystemAlertMock, enforceRateLimitMock } = vi.hoisted(() => ({
  logSystemAlertMock: vi.fn(),
  enforceRateLimitMock: vi.fn(),
}));

const leads = vi.hoisted(() => ({
  createLead: vi.fn(),
  createDiagnosticLead: vi.fn(),
  updateLeadEmailDelivery: vi.fn(),
  markLeadWantsContact: vi.fn(),
}));

const newsletter = vi.hoisted(() => ({
  subscribeOrReactivate: vi.fn(),
  normalizeEmail: vi.fn((e: string) => e.trim().toLowerCase()),
}));

// `lib/email` instancia el cliente de Resend en el import, así que sin este
// mock el módulo revienta al cargarse con `Missing API key`.
vi.mock("@/lib/email", () => ({
  sendWelcomeEmail: vi.fn(async () => ({ ok: true })),
  sendInvoiceEmail: vi.fn(async () => ({ ok: true })),
  sendTaskNotification: vi.fn(async () => ({ ok: true })),
  sendSupportTicketNotification: vi.fn(async () => ({ ok: true })),
  sendTestEmail: vi.fn(async () => ({ ok: true })),
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
vi.mock("@/lib/leads-repo", () => leads);
vi.mock("@/lib/newsletter-repo", () => newsletter);
vi.mock("@/lib/email-env-guard", () => ({ assertEmailEnv: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/lib/privacy", () => ({ hashIp: vi.fn(() => "hash") }));
vi.mock("@/lib/whatsapp/sender", () => ({ sendWhatsApp: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() } }));
vi.mock("@/lib/db/schema", () => ({
  clients: {},
  users: {},
  passwordResetTokens: {},
  leads: {},
}));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ "x-forwarded-for": "203.0.113.9" })),
}));

import {
  subscribeToNewsletterAction,
  submitContactForm,
  submitDiagnostic,
  type DiagnosticFormInput,
} from "./actions";

const RAW_SQL = "INSERT INTO newsletter_subscribers (email) VALUES ($1)";
const CLIENTE_CONFIDENCIAL = "Clínica Smile More — +5213221234567";
const TOKEN_PRIVADO = "re_tokenprivadoderesend";
const ENV_SECRET_NAME = "RESEND_API_KEY";
const STACK_INTERNO = "at Object.<anonymous> (/Users/pixeltec/pixeltec-os/src/lib/db/index.ts:42:11)";
const PROVIDER_BODY = '{"error":{"message":"domain not verified"}}';

const MARCADORES = [
  RAW_SQL,
  CLIENTE_CONFIDENCIAL,
  TOKEN_PRIVADO,
  ENV_SECRET_NAME,
  STACK_INTERNO,
  PROVIDER_BODY,
];

const MESSAGE_ENVENENADO = [
  STACK_INTERNO,
  RAW_SQL,
  `env ${ENV_SECRET_NAME} is not set`,
  CLIENTE_CONFIDENCIAL,
  `token=${TOKEN_PRIVADO}`,
  PROVIDER_BODY,
].join(" | ");

/** Lo que se habría escrito en la columna jsonb `system_alerts.context`. */
function contextoPersistido(): string {
  return JSON.stringify(logSystemAlertMock.mock.calls.map((c) => c[0]?.context));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  // La forma real es `{ allowed, retryAfterSec }`, no `{ ok }`.
  enforceRateLimitMock.mockResolvedValue({ allowed: true, retryAfterSec: 0 });
  logSystemAlertMock.mockResolvedValue(undefined);
});

describe("subscribeToNewsletterAction — la alerta persistida no lleva el error", () => {
  test("un fallo desconocido guarda sólo un código estable", async () => {
    newsletter.subscribeOrReactivate.mockRejectedValueOnce(new Error(MESSAGE_ENVENENADO));

    const result = await subscribeToNewsletterAction("lector@ejemplo.mx");

    // El visitante ya recibía un texto genérico: no cambia.
    expect(result).toEqual({
      success: false,
      error: "No pudimos confirmar tu suscripción. Inténtalo en unos minutos.",
    });

    expect(logSystemAlertMock).toHaveBeenCalledTimes(1);
    const alerta = logSystemAlertMock.mock.calls[0][0];
    expect(alerta.severity).toBe("critical");
    expect(alerta.source).toBe("newsletter");
    expect(alerta.context.code).toBe("newsletter_subscribe_failed");

    const persistido = contextoPersistido();
    for (const marcador of MARCADORES) {
      expect(persistido).not.toContain(marcador);
    }
  });

  test("un fallo de Drizzle no deja SQL ni stack en la columna jsonb", async () => {
    newsletter.subscribeOrReactivate.mockRejectedValueOnce(
      Object.assign(new Error(`duplicate key value violates unique constraint`), {
        name: "PostgresError",
        code: "23505",
        query: RAW_SQL,
        detail: CLIENTE_CONFIDENCIAL,
        stack: STACK_INTERNO,
      })
    );

    await subscribeToNewsletterAction("lector@ejemplo.mx");

    const persistido = contextoPersistido();
    expect(persistido).not.toContain("duplicate key");
    expect(persistido).not.toContain(RAW_SQL);
    expect(persistido).not.toContain(STACK_INTERNO);
  });

  test("el `context` no contiene ninguna clave derivada del error", async () => {
    newsletter.subscribeOrReactivate.mockRejectedValueOnce(new Error(MESSAGE_ENVENENADO));

    await subscribeToNewsletterAction("lector@ejemplo.mx");

    const { context } = logSystemAlertMock.mock.calls[0][0];
    // `code` es nuestro; `email` es deuda de PII declarada para E0g. Nada más.
    expect(Object.keys(context).sort()).toEqual(["code", "email"]);
    expect(context).not.toHaveProperty("error");
  });

  test("el email normalizado se conserva: retirarlo es decisión de E0g, no de este gate", async () => {
    newsletter.subscribeOrReactivate.mockRejectedValueOnce(new Error("cualquier cosa"));

    await subscribeToNewsletterAction("Lector@Ejemplo.MX");

    expect(logSystemAlertMock.mock.calls[0][0].context.email).toBe("lector@ejemplo.mx");
  });

  test("si el correo de bienvenida falla, la alerta guarda un código, no el error de Resend", async () => {
    // Este punto no estaba en el inventario de 22: no usa `err.message` ni
    // `String(err)`, sino `result.error` —que `lib/email.ts` rellena con el
    // `message` crudo de Resend—. Vive dentro de una función autorizada.
    newsletter.subscribeOrReactivate.mockResolvedValueOnce({ status: "subscribed" });

    await subscribeToNewsletterAction("lector@ejemplo.mx");

    const alertas = logSystemAlertMock.mock.calls.map((c) => c[0]);
    for (const alerta of alertas) {
      expect(alerta.context).not.toHaveProperty("error");
    }
    const persistido = contextoPersistido();
    for (const marcador of MARCADORES) {
      expect(persistido).not.toContain(marcador);
    }
  });
});

describe("submitContactForm — la alerta persistida no lleva el error", () => {
  function makeFormData() {
    const fd = new FormData();
    fd.set("name", "Miguel Robles");
    fd.set("email", "contacto@ejemplo.mx");
    fd.set("message", "Quiero cotizar un ecosistema digital para mi clínica.");
    fd.set("consent", "on");
    return fd;
  }

  test("un fallo de `createLead` guarda sólo un código estable", async () => {
    leads.createLead.mockRejectedValueOnce(new Error(MESSAGE_ENVENENADO));

    const result = await submitContactForm({} as never, makeFormData());

    // El visitante ya veía un texto genérico: no cambia.
    expect(result.isSuccess).toBe(false);
    expect(result.message).toBe("Ocurrió un error inesperado. Inténtalo de nuevo en unos minutos.");

    const alerta = logSystemAlertMock.mock.calls[0][0];
    expect(alerta.source).toBe("contact_form");
    expect(alerta.context).toEqual({ code: "contact_create_lead_failed" });

    const persistido = contextoPersistido();
    for (const marcador of MARCADORES) {
      expect(persistido).not.toContain(marcador);
    }
  });

  test("un fallo de Drizzle no deja SQL en la columna jsonb", async () => {
    leads.createLead.mockRejectedValueOnce(
      Object.assign(new Error("null value violates not-null constraint"), {
        name: "PostgresError",
        query: RAW_SQL,
        stack: STACK_INTERNO,
      })
    );

    await submitContactForm({} as never, makeFormData());

    const persistido = contextoPersistido();
    expect(persistido).not.toContain(RAW_SQL);
    expect(persistido).not.toContain(STACK_INTERNO);
    expect(persistido).not.toContain("not-null constraint");
  });
});

describe("submitDiagnostic — la alerta persistida no lleva el error", () => {
  const INPUT: DiagnosticFormInput = {
    name: "Miguel Robles",
    email: "contacto@ejemplo.mx",
    companyType: "clinica",
    problems: ["agenda"],
    companySize: "1-10",
    priority: "alta",
    consent: "on",
  };

  test("un fallo de `createDiagnosticLead` guarda sólo un código estable", async () => {
    leads.createDiagnosticLead.mockRejectedValueOnce(new Error(MESSAGE_ENVENENADO));

    const result = (await submitDiagnostic(INPUT)) as { ok: boolean; message?: string };

    expect(result.ok).toBe(false);
    expect(result.message).toBe("Ocurrió un error inesperado. Inténtalo de nuevo en unos minutos.");

    const alerta = logSystemAlertMock.mock.calls[0][0];
    expect(alerta.source).toBe("diagnostic");
    expect(alerta.context).toEqual({ code: "diagnostic_create_lead_failed" });

    const persistido = contextoPersistido();
    for (const marcador of MARCADORES) {
      expect(persistido).not.toContain(marcador);
    }
  });
});
