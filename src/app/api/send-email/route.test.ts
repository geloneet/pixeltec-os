import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * E0f-3b: esta ruta devuelve el `EmailResult` completo al cliente
 * (`NextResponse.json(result)`). Con el origen saneado, lo único que puede
 * viajar en `error` es un código estable — este test fija el pass-through y
 * que el contrato de éxito no cambió.
 */

const { sendTestEmailMock, requireSessionMock } = vi.hoisted(() => ({
  sendTestEmailMock: vi.fn(),
  requireSessionMock: vi.fn(),
}));

vi.mock("@/lib/email", () => ({ sendTestEmail: sendTestEmailMock }));
vi.mock("@/lib/auth/session", () => ({ getSessionUserId: requireSessionMock }));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => ({ value: "session-cookie" }) })),
}));

import { POST } from "./route";

const RESEND_RAW_BODY = '{"statusCode":403,"name":"validation_error","message":"The pixeltec.mx domain is not verified"}';

function makeRequest() {
  return new NextRequest("http://localhost/api/send-email", {
    method: "POST",
    body: JSON.stringify({ type: "test", to: "prueba@pixeltec.mx" }),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("RESEND_API_KEY", "clave-sintetica-de-test");
  requireSessionMock.mockResolvedValue("11111111-1111-4111-8111-111111111111");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/send-email — el reflejo del EmailResult solo lleva códigos", () => {
  test("un fallo del envío responde 500 con el código estable, sin el body de Resend", async () => {
    sendTestEmailMock.mockResolvedValueOnce({ success: false, error: "email_provider_failed" });

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ success: false, error: "email_provider_failed" });
    expect(JSON.stringify(body)).not.toContain(RESEND_RAW_BODY);
  });

  test("el éxito conserva el contrato {success, id}", async () => {
    sendTestEmailMock.mockResolvedValueOnce({ success: true, id: "em_123" });

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, id: "em_123" });
  });
});
