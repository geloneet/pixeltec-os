import { describe, expect, test, vi, beforeEach } from "vitest";

/**
 * Saneamiento EN ORIGEN de `EmailResult.error` (E0f-3b).
 *
 * `sendEmail` es el único punto que habla con Resend y TODOS los senders de
 * dominio delegan en él; su `error` se persiste tal cual en
 * `leads.email_delivery_error` y en `system_alerts.context`, y cruza rutas
 * HTTP. Estos tests fijan el contrato: `error` es siempre un código estable
 * (`email_egress_blocked` | `email_provider_failed` | `email_unknown_failure`)
 * y ni el `message` de Resend ni un throw desconocido aportan un carácter —
 * con eso, los consumidores que hacen pass-through quedan sanos sin editarse.
 */

const { sendMock, assertEmailEgressAllowedMock, EgressBlockedErrorMock } = vi.hoisted(() => {
  class EgressBlockedErrorMock extends Error {
    readonly code: string;
    readonly reason: string;
    constructor(code: string, reason: string) {
      super(reason);
      this.name = "EgressBlockedError";
      this.code = code;
      this.reason = reason;
    }
  }
  return {
    sendMock: vi.fn(),
    assertEmailEgressAllowedMock: vi.fn(),
    EgressBlockedErrorMock,
  };
});

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: sendMock };
  },
}));
vi.mock("@/lib/egress-guard", () => ({
  assertEmailEgressAllowed: assertEmailEgressAllowedMock,
  EgressBlockedError: EgressBlockedErrorMock,
}));

// Los renders de plantillas importan React Email; irrelevantes para el contrato.
vi.mock("@/emails/WelcomeEmail", () => ({ renderWelcomeEmail: () => "<html/>" }));
vi.mock("@/emails/InvoiceEmail", () => ({ renderInvoiceEmail: () => "<html/>" }));
vi.mock("@/emails/TaskAssignedEmail", () => ({ renderTaskAssignedEmail: () => "<html/>" }));
vi.mock("@/emails/SupportTicketEmail", () => ({ renderSupportTicketEmail: () => "<html/>" }));
vi.mock("@/emails/ContactConfirmationEmail", () => ({ renderContactConfirmationEmail: () => "<html/>" }));
vi.mock("@/emails/ContactNotificationEmail", () => ({ renderContactNotificationEmail: () => "<html/>" }));
vi.mock("@/emails/DiagnosticNotificationEmail", () => ({ renderDiagnosticNotificationEmail: () => "<html/>" }));
vi.mock("@/emails/PasswordResetEmail", () => ({ renderPasswordResetEmail: () => "<html/>" }));
vi.mock("@/emails/PasswordChangedEmail", () => ({ renderPasswordChangedEmail: () => "<html/>" }));
vi.mock("@/emails/NewsletterWelcomeEmail", () => ({ renderNewsletterWelcomeEmail: () => "<html/>" }));
vi.mock("@/emails/ProposalEmail", () => ({ renderProposalEmail: () => "<html/>" }));
vi.mock("@/emails/ProposalDecisionEmail", () => ({ renderProposalDecisionEmail: () => "<html/>" }));

import { sendEmail, sendPasswordResetEmail } from "./email";

const RESEND_RAW_BODY = '{"statusCode":403,"name":"validation_error","message":"The pixeltec.mx domain is not verified"}';
const TOKEN_PRIVADO = "re_tokenprivadoderesend";
const STACK_INTERNO = "at Object.<anonymous> (/Users/pixeltec/pixeltec-os/src/lib/email.ts:64:31)";
const CLIENTE_CONFIDENCIAL = "Clínica Smile More — +5213221234567";
const MARCADORES = [RESEND_RAW_BODY, TOKEN_PRIVADO, STACK_INTERNO, CLIENTE_CONFIDENCIAL];

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  assertEmailEgressAllowedMock.mockImplementation(() => {});
});

function serializar(valor: unknown): string {
  return JSON.stringify(valor) ?? "";
}

describe("sendEmail — el contrato solo lleva códigos estables", () => {
  test("un error de Resend devuelve email_provider_failed, sin el body del proveedor", async () => {
    sendMock.mockResolvedValueOnce({
      data: null,
      error: { name: "validation_error", message: RESEND_RAW_BODY },
    });

    const result = await sendEmail("cliente@ejemplo.mx", "Asunto", "<p>hola</p>");

    expect(result).toEqual({ success: false, error: "email_provider_failed" });
    for (const marcador of MARCADORES) {
      expect(serializar(result)).not.toContain(marcador);
    }
  });

  test("un throw desconocido devuelve email_unknown_failure, sin message ni stack", async () => {
    sendMock.mockRejectedValueOnce(
      Object.assign(new Error(`token=${TOKEN_PRIVADO} ${CLIENTE_CONFIDENCIAL}`), {
        stack: STACK_INTERNO,
      })
    );

    const result = await sendEmail("cliente@ejemplo.mx", "Asunto", "<p>hola</p>");

    expect(result).toEqual({ success: false, error: "email_unknown_failure" });
    for (const marcador of MARCADORES) {
      expect(serializar(result)).not.toContain(marcador);
    }
  });

  test("el bloqueo de egress conserva su código estable existente", async () => {
    assertEmailEgressAllowedMock.mockImplementationOnce(() => {
      throw new EgressBlockedErrorMock("email_egress_blocked", "destinatario fuera de la allowlist");
    });

    const result = await sendEmail("fuera@externo.com", "Asunto", "<p>hola</p>");

    expect(result).toEqual({ success: false, error: "email_egress_blocked" });
    expect(sendMock).not.toHaveBeenCalled();
  });

  test("el éxito conserva success e id sin cambios", async () => {
    sendMock.mockResolvedValueOnce({ data: { id: "em_123" }, error: null });

    const result = await sendEmail("cliente@ejemplo.mx", "Asunto", "<p>hola</p>");

    expect(result).toEqual({ success: true, id: "em_123" });
  });

  test("el log tampoco lleva el texto del proveedor — solo el name", async () => {
    sendMock.mockResolvedValueOnce({
      data: null,
      error: { name: "validation_error", message: RESEND_RAW_BODY },
    });
    sendMock.mockRejectedValueOnce(new Error(`token=${TOKEN_PRIVADO}`));

    await sendEmail("cliente@ejemplo.mx", "Asunto", "<p>hola</p>");
    await sendEmail("cliente@ejemplo.mx", "Asunto", "<p>hola</p>");

    const registrado = serializar(errorSpy.mock.calls.flat().map(String));
    for (const marcador of MARCADORES) {
      expect(registrado).not.toContain(marcador);
    }
  });
});

describe("senders de dominio — heredan el contrato de sendEmail", () => {
  test("sendPasswordResetEmail propaga el código, no el texto de Resend", async () => {
    sendMock.mockResolvedValueOnce({
      data: null,
      error: { name: "application_error", message: RESEND_RAW_BODY },
    });

    const result = await sendPasswordResetEmail({
      email: "staff@pixeltec.mx",
      name: "Staff",
      resetUrl: "https://pixeltec.mx/reset-password?token=x",
      expiresIn: "1 hora",
    });

    expect(result).toEqual({ success: false, error: "email_provider_failed" });
  });
});
