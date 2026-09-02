import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * `GET /api/whatsapp-inbox/account` (WO-2026-00181).
 *
 * Es lo primero que abre un revisor de Meta para comprobar
 * `whatsapp_business_management`, así que su contrato es estricto: sin
 * configuración responde 200 con `configured:false` (nunca 500 — un 500 se lee
 * como «app rota»), y si una de las dos lecturas falla devuelve la otra con un
 * `errors` saneado en vez de tirar la vista entera.
 */

const { guardMock, configMock, phoneMock, profileMock } = vi.hoisted(() => ({
  guardMock: vi.fn(),
  configMock: vi.fn(),
  phoneMock: vi.fn(),
  profileMock: vi.fn(),
}));

vi.mock("@/lib/auth-guards", () => ({
  requireWhatsAppReviewAccess: guardMock,
  requireAdmin: guardMock,
}));

vi.mock("@/lib/whatsapp/management", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/whatsapp/management")>();
  return {
    ...real,
    getManagementConfig: configMock,
    getPhoneNumberInfo: phoneMock,
    getBusinessProfile: profileMock,
  };
});

import { ManagementError } from "@/lib/whatsapp/management";
import { EgressBlockedError } from "@/lib/egress-guard";
import { GET } from "./route";

const TOKEN = "EAAG-token-de-prueba-no-real-9999";

const PHONE = {
  id: "111222333444",
  displayPhoneNumber: "+52 1 322 137 8336",
  verifiedName: "PixelTEC",
  qualityRating: "GREEN",
  nameStatus: "APPROVED",
  codeVerificationStatus: "VERIFIED",
  messagingLimitTier: "TIER_1K",
  platformType: "CLOUD_API",
};

const PROFILE = {
  about: "Software a la medida",
  address: "Puerto Vallarta",
  description: "Agencia",
  email: "hola@pixeltec.mx",
  profilePictureUrl: null,
  websites: ["https://pixeltec.mx"],
  vertical: "PROF_SERVICES",
};

function req() {
  return new NextRequest("http://localhost/api/whatsapp-inbox/account");
}

beforeEach(() => {
  vi.clearAllMocks();
  guardMock.mockResolvedValue({ ok: true, uid: "admin-1", isAdmin: true });
  configMock.mockReturnValue({
    configured: true,
    phoneNumberId: "111222333444",
    businessAccountId: "999888777666",
    apiVersion: "v21.0",
  });
  phoneMock.mockResolvedValue(PHONE);
  profileMock.mockResolvedValue(PROFILE);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("guard", () => {
  test("usa requireWhatsAppReviewAccess con la ruta y corta sin tocar Meta", async () => {
    guardMock.mockResolvedValue({ ok: false, error: "forbidden", status: 403 });

    const res = await GET(req());

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "forbidden" });
    expect(guardMock).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ route: "/api/whatsapp-inbox/account" })
    );
    expect(phoneMock).not.toHaveBeenCalled();
    expect(profileMock).not.toHaveBeenCalled();
  });

  test("sin sesión: 401", async () => {
    guardMock.mockResolvedValue({ ok: false, error: "Unauthorized", status: 401 });
    expect((await GET(req())).status).toBe(401);
  });
});

describe("camino feliz", () => {
  test("200 con número y perfil", async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ configured: true, phone: PHONE, profile: PROFILE });
  });
});

describe("sin configurar", () => {
  test("200 con configured:false y las env que faltan (nunca 500)", async () => {
    configMock.mockReturnValue({ configured: false, missing: ["WHATSAPP_BUSINESS_ACCOUNT_ID"] });

    const res = await GET(req());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      configured: false,
      missing: ["WHATSAPP_BUSINESS_ACCOUNT_ID"],
    });
    expect(phoneMock).not.toHaveBeenCalled();
  });
});

describe("fallos parciales", () => {
  test("si falla el perfil, el número sigue llegando + errors saneado", async () => {
    profileMock.mockRejectedValue(
      new ManagementError({ status: 400, message: "Meta rechazó la petición (400): sin permiso." })
    );

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.phone).toEqual(PHONE);
    expect(body.profile).toBeUndefined();
    expect(body.errors).toEqual(["Meta rechazó la petición (400): sin permiso."]);
  });

  test("si falla el número, el perfil sigue llegando", async () => {
    phoneMock.mockRejectedValue(new ManagementError({ status: 404, message: "Meta rechazó la petición (404): no existe." }));

    const body = await (await GET(req())).json();

    expect(body.profile).toEqual(PROFILE);
    expect(body.phone).toBeUndefined();
    expect(body.errors).toHaveLength(1);
  });

  test("un error desconocido no aporta su message", async () => {
    profileMock.mockRejectedValue(new Error(`Bearer ${TOKEN} SELECT * FROM users`));

    const body = await (await GET(req())).json();

    expect(JSON.stringify(body)).not.toContain(TOKEN);
    expect(JSON.stringify(body)).not.toContain("SELECT");
    expect(body.errors).toEqual(["No se pudo leer el perfil de empresa."]);
  });

  test("si fallan las dos: 502 con code meta_error", async () => {
    phoneMock.mockRejectedValue(new ManagementError({ status: 500, message: "Meta rechazó la petición (500): x." }));
    profileMock.mockRejectedValue(new ManagementError({ status: 500, message: "Meta rechazó la petición (500): y." }));

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.code).toBe("meta_error");
    expect(body.errors).toHaveLength(2);
  });

  test("egress bloqueado: mensaje de política, sin destino", async () => {
    const bloqueo = new EgressBlockedError({
      channel: "whatsapp",
      operation: "read",
      reason: "mode_disabled",
    });
    phoneMock.mockRejectedValue(bloqueo);
    profileMock.mockRejectedValue(bloqueo);

    const res = await GET(req());
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.code).toBe("egress_blocked");
  });
});
