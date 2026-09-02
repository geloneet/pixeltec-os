import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * `GET`/`POST /api/whatsapp-inbox/templates` (WO-2026-00181).
 *
 * El POST es LA acción que Meta exige ver en el screencast de
 * `whatsapp_business_management`: crear una plantilla. Su contrato separa tres
 * fallos que no deben confundirse — entrada inválida (400, con la lista de
 * errores del builder), plantilla rechazada por Meta (502) y cuenta sin
 * configurar (503) — y ninguno filtra el token ni el cuerpo de Graph.
 */

const { guardMock, configMock, listMock, createMock } = vi.hoisted(() => ({
  guardMock: vi.fn(),
  configMock: vi.fn(),
  listMock: vi.fn(),
  createMock: vi.fn(),
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
    listMessageTemplates: listMock,
    createMessageTemplate: createMock,
  };
});

import { ManagementError } from "@/lib/whatsapp/management";
import { EgressBlockedError } from "@/lib/egress-guard";
import { GET, POST } from "./route";

const TOKEN = "EAAG-token-de-prueba-no-real-9999";

const PLANTILLA = {
  id: "1001",
  name: "pedido_listo",
  language: "es_MX",
  status: "APPROVED",
  category: "UTILITY",
  components: [{ type: "BODY", format: null, text: "Hola {{1}}" }],
  rejectedReason: null,
  qualityScore: "GREEN",
};

const VALIDO = {
  name: "pedido_listo",
  language: "es_MX",
  category: "UTILITY",
  body: "Hola {{1}}, tu pedido está listo.",
  examples: ["Miguel"],
};

function get() {
  return new NextRequest("http://localhost/api/whatsapp-inbox/templates");
}

function post(body: unknown, opciones?: { crudo?: string }) {
  return new NextRequest("http://localhost/api/whatsapp-inbox/templates", {
    method: "POST",
    body: opciones?.crudo ?? JSON.stringify(body),
  });
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
  listMock.mockResolvedValue([PLANTILLA]);
  createMock.mockResolvedValue({ id: "2002", status: "PENDING", name: "pedido_listo" });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET", () => {
  test("200 con la lista de plantillas", async () => {
    const res = await GET(get());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ configured: true, templates: [PLANTILLA] });
  });

  test("sin configurar: 200 con configured:false y lista vacía", async () => {
    configMock.mockReturnValue({ configured: false, missing: ["WHATSAPP_ACCESS_TOKEN"] });

    const res = await GET(get());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      configured: false,
      missing: ["WHATSAPP_ACCESS_TOKEN"],
      templates: [],
    });
    expect(listMock).not.toHaveBeenCalled();
  });

  test("guard: 403 sin tocar Meta", async () => {
    guardMock.mockResolvedValue({ ok: false, error: "forbidden", status: 403 });
    const res = await GET(get());
    expect(res.status).toBe(403);
    expect(listMock).not.toHaveBeenCalled();
    expect(guardMock).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ route: "/api/whatsapp-inbox/templates" })
    );
  });

  test("error de Meta: 502 saneado", async () => {
    listMock.mockRejectedValue(
      new ManagementError({ status: 401, message: "Meta rechazó la petición (401): token inválido." })
    );

    const res = await GET(get());
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.code).toBe("meta_error");
    expect(body.error).toContain("token inválido");
  });

  test("error desconocido: 500 sin su message", async () => {
    listMock.mockRejectedValue(new Error(`Bearer ${TOKEN}`));

    const res = await GET(get());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.code).toBe("internal_error");
    expect(JSON.stringify(body)).not.toContain(TOKEN);
  });
});

describe("POST", () => {
  test("201 con id, status y name", async () => {
    const res = await POST(post(VALIDO));

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: "2002", status: "PENDING", name: "pedido_listo" });
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "pedido_listo", category: "UTILITY" })
    );
  });

  test("guard: 403 sin crear nada", async () => {
    guardMock.mockResolvedValue({ ok: false, error: "forbidden", status: 403 });
    const res = await POST(post(VALIDO));
    expect(res.status).toBe(403);
    expect(createMock).not.toHaveBeenCalled();
  });

  test("cuerpo que no es JSON: 400 invalid_body", async () => {
    const res = await POST(post(null, { crudo: '{"name":' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Cuerpo JSON inválido", code: "invalid_body" });
    expect(createMock).not.toHaveBeenCalled();
  });

  test("plantilla inválida: 400 invalid_template con details, sin llamar a Meta", async () => {
    const res = await POST(post({ ...VALIDO, name: "MAL", language: "pt_BR" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe("invalid_template");
    expect(body.details).toEqual(
      expect.arrayContaining([
        "name: solo se admiten minúsculas, números y guion bajo (1 a 512 caracteres).",
        "language: idioma no admitido. Usa uno de: es_MX, es, en_US, en.",
      ])
    );
    expect(createMock).not.toHaveBeenCalled();
  });

  test("sin configurar: 503, sin llamar a Meta", async () => {
    configMock.mockReturnValue({ configured: false, missing: ["WHATSAPP_ACCESS_TOKEN"] });

    const res = await POST(post(VALIDO));
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.code).toBe("not_configured");
    expect(body.missing).toEqual(["WHATSAPP_ACCESS_TOKEN"]);
    expect(createMock).not.toHaveBeenCalled();
  });

  test("Meta rechaza: 502 meta_error con el motivo, sin el token", async () => {
    createMock.mockRejectedValue(
      new ManagementError({
        status: 400,
        code: 100,
        message: `Meta rechazó la petición (400): El nombre ya existe. ***9999`,
      })
    );

    const res = await POST(post(VALIDO));
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.code).toBe("meta_error");
    expect(body.error).toContain("El nombre ya existe.");
    expect(JSON.stringify(body)).not.toContain(TOKEN);
  });

  test("egress bloqueado: 503 sin citar el destino", async () => {
    createMock.mockRejectedValue(
      new EgressBlockedError({ channel: "whatsapp", operation: "publish", reason: "mode_disabled" })
    );

    const res = await POST(post(VALIDO));
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.code).toBe("egress_blocked");
    expect(JSON.stringify(body)).not.toContain("mode_disabled");
  });

  test("error desconocido: 500 sin su message", async () => {
    createMock.mockRejectedValue(new Error(`SELECT * FROM users -- ${TOKEN}`));

    const res = await POST(post(VALIDO));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.code).toBe("internal_error");
    expect(JSON.stringify(body)).not.toContain(TOKEN);
    expect(JSON.stringify(body)).not.toContain("SELECT");
  });
});
