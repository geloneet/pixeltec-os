import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Contrato de fallo de las 17 rutas del subsistema (21 handlers HTTP).
 *
 * Las suites por endpoint que ya existían prueban el camino feliz. Ésta prueba
 * lo otro: que ninguna ruta devuelva texto que no hayamos escrito nosotros, y
 * que la autenticación corte antes de tocar cualquier dependencia.
 *
 * Volver a mockear una respuesta exitosa no demuestra nada de eso.
 */

const {
  requireAdminMock,
  fetchPixelbotMock,
  whatsappGuardMock,
  listContactsMock,
  upsertContactMock,
  listNotesMock,
  addNoteMock,
  dbInsertMock,
} = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  fetchPixelbotMock: vi.fn(),
  whatsappGuardMock: vi.fn(),
  listContactsMock: vi.fn(),
  upsertContactMock: vi.fn(),
  listNotesMock: vi.fn(),
  addNoteMock: vi.fn(),
  dbInsertMock: vi.fn(),
}));

vi.mock("@/lib/auth-guards", () => ({
  requireAdmin: requireAdminMock,
  // WO-2026-00051: la allowlist del reviewer usa este guard; misma semántica en el mock.
  requireWhatsAppReviewAccess: requireAdminMock,
}));
vi.mock("@/lib/whatsapp-inbox/pixelbot-client", () => ({ fetchPixelbot: fetchPixelbotMock }));
vi.mock("@/lib/db/repos/whatsapp-contacts", () => ({
  listContacts: listContactsMock,
  upsertContact: upsertContactMock,
  listNotes: listNotesMock,
  addNote: addNoteMock,
}));
vi.mock("@/lib/db", () => ({ db: { insert: dbInsertMock } }));
vi.mock("@/lib/egress-guard", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/egress-guard")>();
  return { ...real, assertWhatsAppEgressAllowed: whatsappGuardMock };
});

import { EgressBlockedError } from "@/lib/egress-guard";
import { PixelbotError } from "@/lib/whatsapp-inbox/errors";

/** Texto que un tercero podría poner en un error y que jamás puede salir. */
const VENENO =
  'Traceback: File "/app/agent/main.py" SELECT * FROM mensajes WHERE telefono=\'+5213221234567\' ' +
  "X-Internal-Secret: s3cr3t-interno-de-32-chars-largo http://pixelbot:3011";

const FRAGMENTOS_PROHIBIDOS = [
  "Traceback",
  "/app/agent/main.py",
  "SELECT",
  "+5213221234567",
  "s3cr3t-interno-de-32-chars-largo",
  "http://pixelbot:3011",
];

type Dependencia = "pixelbot" | "listContacts" | "upsertContact" | "listNotes" | "addNote" | "db";

type Caso = {
  nombre: string;
  dependencia: Dependencia;
  invocar: () => Promise<Response>;
};

function req(url: string, init?: { method?: string; body?: unknown }) {
  return new NextRequest(`http://localhost${url}`, {
    method: init?.method ?? "GET",
    ...(init?.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });
}

/** Las 21 entradas: una por handler HTTP exportado. */
const CASOS: Caso[] = [
  {
    nombre: "GET /config",
    dependencia: "pixelbot",
    invocar: async () => (await import("./config/route")).GET(req("/api/whatsapp-inbox/config")),
  },
  {
    nombre: "PUT /config",
    dependencia: "pixelbot",
    invocar: async () =>
      (await import("./config/route")).PUT(
        req("/api/whatsapp-inbox/config", { method: "PUT", body: { config: { bot_name: "x" } } })
      ),
  },
  {
    nombre: "POST /config/draft",
    dependencia: "pixelbot",
    invocar: async () =>
      (await import("./config/draft/route")).POST(
        req("/api/whatsapp-inbox/config/draft", { method: "POST", body: { config: { a: 1 } } })
      ),
  },
  {
    nombre: "POST /config/publish",
    dependencia: "pixelbot",
    invocar: async () =>
      (await import("./config/publish/route")).POST(
        req("/api/whatsapp-inbox/config/publish", { method: "POST", body: { version: 4 } })
      ),
  },
  {
    nombre: "POST /config/rollback",
    dependencia: "pixelbot",
    invocar: async () =>
      (await import("./config/rollback/route")).POST(
        req("/api/whatsapp-inbox/config/rollback", { method: "POST", body: { version: 3 } })
      ),
  },
  {
    nombre: "GET /config/versions",
    dependencia: "pixelbot",
    invocar: async () =>
      (await import("./config/versions/route")).GET(req("/api/whatsapp-inbox/config/versions")),
  },
  {
    nombre: "GET /conversations",
    dependencia: "pixelbot",
    invocar: async () =>
      (await import("./conversations/route")).GET(req("/api/whatsapp-inbox/conversations")),
  },
  {
    nombre: "POST /conversations/read",
    dependencia: "pixelbot",
    invocar: async () =>
      (await import("./conversations/read/route")).POST(
        req("/api/whatsapp-inbox/conversations/read", {
          method: "POST",
          body: { phone: "+5213221234567" },
        })
      ),
  },
  {
    nombre: "GET /conversations/[phone]/messages",
    dependencia: "pixelbot",
    invocar: async () =>
      (await import("./conversations/[phone]/messages/route")).GET(
        req("/api/whatsapp-inbox/conversations/x/messages"),
        { params: Promise.resolve({ phone: "+5213221234567" }) }
      ),
  },
  {
    nombre: "GET /examples",
    dependencia: "pixelbot",
    invocar: async () => (await import("./examples/route")).GET(req("/api/whatsapp-inbox/examples")),
  },
  {
    nombre: "POST /examples",
    dependencia: "pixelbot",
    invocar: async () =>
      (await import("./examples/route")).POST(
        req("/api/whatsapp-inbox/examples", {
          method: "POST",
          body: { customer_msg: "hola", ideal_reply: "qué tal" },
        })
      ),
  },
  {
    nombre: "POST /examples/[id]/active",
    dependencia: "pixelbot",
    invocar: async () =>
      (await import("./examples/[id]/active/route")).POST(
        req("/api/whatsapp-inbox/examples/7/active", { method: "POST", body: { active: true } }),
        { params: Promise.resolve({ id: "7" }) }
      ),
  },
  {
    nombre: "GET /memory",
    dependencia: "pixelbot",
    invocar: async () =>
      (await import("./memory/route")).GET(req("/api/whatsapp-inbox/memory?phone=%2B5213221234567")),
  },
  {
    nombre: "POST /mode",
    dependencia: "pixelbot",
    invocar: async () =>
      (await import("./mode/route")).POST(
        req("/api/whatsapp-inbox/mode", {
          method: "POST",
          body: { phone: "+5213221234567", mode: "HUMAN" },
        })
      ),
  },
  {
    nombre: "POST /send",
    dependencia: "pixelbot",
    invocar: async () =>
      (await import("./send/route")).POST(
        req("/api/whatsapp-inbox/send", {
          method: "POST",
          body: { phone: "+5213221234567", text: "hola" },
        })
      ),
  },
  {
    nombre: "POST /simulate",
    dependencia: "pixelbot",
    invocar: async () =>
      (await import("./simulate/route")).POST(
        req("/api/whatsapp-inbox/simulate", { method: "POST", body: { message: "hola" } })
      ),
  },
  {
    nombre: "GET /contacts",
    dependencia: "listContacts",
    invocar: async () => (await import("./contacts/route")).GET(req("/api/whatsapp-inbox/contacts")),
  },
  {
    nombre: "POST /contacts",
    dependencia: "upsertContact",
    invocar: async () =>
      (await import("./contacts/route")).POST(
        req("/api/whatsapp-inbox/contacts", {
          method: "POST",
          body: { phone: "+5213221234567", patch: {} },
        })
      ),
  },
  {
    nombre: "GET /contacts/[phone]/notes",
    dependencia: "listNotes",
    invocar: async () =>
      (await import("./contacts/[phone]/notes/route")).GET(
        req("/api/whatsapp-inbox/contacts/x/notes"),
        { params: Promise.resolve({ phone: "+5213221234567" }) }
      ),
  },
  {
    nombre: "POST /contacts/[phone]/notes",
    dependencia: "addNote",
    invocar: async () =>
      (await import("./contacts/[phone]/notes/route")).POST(
        req("/api/whatsapp-inbox/contacts/x/notes", { method: "POST", body: { text: "una nota" } }),
        { params: Promise.resolve({ phone: "+5213221234567" }) }
      ),
  },
  {
    nombre: "POST /tickets",
    dependencia: "db",
    invocar: async () =>
      (await import("./tickets/route")).POST(
        req("/api/whatsapp-inbox/tickets", {
          method: "POST",
          body: { problema: "no responde", phone: "+5213221234567" },
        })
      ),
  },
];

const MOCKS: Record<Dependencia, () => ReturnType<typeof vi.fn>> = {
  pixelbot: () => fetchPixelbotMock,
  listContacts: () => listContactsMock,
  upsertContact: () => upsertContactMock,
  listNotes: () => listNotesMock,
  addNote: () => addNoteMock,
  db: () => dbInsertMock,
};

/** Hace que la dependencia de la ruta falle con `err`. */
function romper(dep: Dependencia, err: unknown) {
  MOCKS[dep]().mockImplementationOnce(() => {
    throw err;
  });
}

const ENV_ORIGINAL = process.env.PIXELBOT_TENANT_ID;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.PIXELBOT_TENANT_ID = "tenant-abc-123";
  requireAdminMock.mockResolvedValue({ ok: true, uid: "admin-1", isAdmin: true });
  whatsappGuardMock.mockReturnValue(undefined);
  // Camino feliz por defecto: cada caso rompe solo lo que necesita.
  fetchPixelbotMock.mockResolvedValue({ data: { ok: true }, status: 200 });
  listContactsMock.mockResolvedValue([]);
  upsertContactMock.mockResolvedValue({});
  listNotesMock.mockResolvedValue([]);
  addNoteMock.mockResolvedValue({});
  dbInsertMock.mockReturnValue({
    values: () => ({ returning: async () => [{ id: 1 }] }),
  });
});

afterEach(() => {
  if (ENV_ORIGINAL === undefined) delete process.env.PIXELBOT_TENANT_ID;
  else process.env.PIXELBOT_TENANT_ID = ENV_ORIGINAL;
});

describe.each(CASOS.map((c) => [c.nombre, c] as const))("%s", (_nombre, caso) => {
  test("autenticación inválida corta antes de tocar la dependencia", async () => {
    requireAdminMock.mockResolvedValue({ ok: false, error: "No autorizado", status: 401 });

    const res = await caso.invocar();

    expect(res.status).toBe(401);
    expect(MOCKS[caso.dependencia]()).not.toHaveBeenCalled();
  });

  test("un fallo del upstream sale saneado y con el status del contrato", async () => {
    romper(caso.dependencia, new PixelbotError({ code: "pixelbot_upstream", status: 500 }));

    const res = await caso.invocar();
    const body = await res.json();

    // 5xx del upstream se traduce a 502. Las rutas de Postgres no producen
    // PixelbotError en producción, pero el traductor es el mismo para todas.
    expect(res.status).toBe(502);
    expect(body.code).toBe("pixelbot_upstream");
    expect(typeof body.error).toBe("string");
    for (const fragmento of FRAGMENTOS_PROHIBIDOS) {
      expect(JSON.stringify(body)).not.toContain(fragmento);
    }
  });

  test("un error desconocido no aporta su message", async () => {
    romper(caso.dependencia, new Error(VENENO));

    const res = await caso.invocar();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.code).toBe("internal_error");
    expect(typeof body.error).toBe("string");
    for (const fragmento of FRAGMENTOS_PROHIBIDOS) {
      expect(JSON.stringify(body)).not.toContain(fragmento);
    }
  });

  test("un valor lanzado que no es Error tampoco se stringifica", async () => {
    romper(caso.dependencia, VENENO);

    const res = await caso.invocar();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.code).toBe("internal_error");
    for (const fragmento of FRAGMENTOS_PROHIBIDOS) {
      expect(JSON.stringify(body)).not.toContain(fragmento);
    }
  });

  test("un bloqueo de egress sale como 503 sin citar el destino", async () => {
    romper(
      caso.dependencia,
      new EgressBlockedError({
        channel: "internal",
        operation: "read",
        reason: "target_not_allowed",
      })
    );

    const res = await caso.invocar();
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.code).toBe("egress_blocked");
    for (const fragmento of FRAGMENTOS_PROHIBIDOS) {
      expect(JSON.stringify(body)).not.toContain(fragmento);
    }
  });
});

describe("upstream 4xx conserva el status", () => {
  test.each([400, 404, 409, 422, 429])("PixelBot %i → misma respuesta HTTP", async (status) => {
    fetchPixelbotMock.mockImplementationOnce(() => {
      throw new PixelbotError({ code: "pixelbot_upstream", status });
    });

    const res = await (await import("./config/route")).GET(req("/api/whatsapp-inbox/config"));
    const body = await res.json();

    expect(res.status).toBe(status);
    expect(body.code).toBe("pixelbot_upstream");
  });

  test.each([
    ["pixelbot_timeout", 504],
    ["pixelbot_unreachable", 502],
    ["pixelbot_redirect_blocked", 502],
    ["pixelbot_invalid_response", 502],
    ["pixelbot_not_configured", 503],
  ] as const)("%s → %i", async (code, esperado) => {
    fetchPixelbotMock.mockImplementationOnce(() => {
      throw new PixelbotError({ code });
    });

    const res = await (await import("./config/route")).GET(req("/api/whatsapp-inbox/config"));
    expect(res.status).toBe(esperado);
    expect((await res.json()).code).toBe(code);
  });
});

describe("cuerpo JSON malformado → 400, no 500 con eco", () => {
  test("send responde 400 y no llama a PixelBot", async () => {
    const peticion = new NextRequest("http://localhost/api/whatsapp-inbox/send", {
      method: "POST",
      body: '{"phone":"+5213221234567","text":"hola"',
    });

    const res = await (await import("./send/route")).POST(peticion);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(fetchPixelbotMock).not.toHaveBeenCalled();
    expect(JSON.stringify(body)).not.toContain("+5213221234567");
  });
});

describe("/internal/send — doble guard", () => {
  test("pasa por la allowlist de WhatsApp antes de llamar a PixelBot", async () => {
    await (await import("./send/route")).POST(
      req("/api/whatsapp-inbox/send", {
        method: "POST",
        body: { phone: "+5213221234567", text: "hola" },
      })
    );

    expect(whatsappGuardMock).toHaveBeenCalledWith("+5213221234567");
    expect(fetchPixelbotMock).toHaveBeenCalledTimes(1);
    expect(whatsappGuardMock.mock.invocationCallOrder[0]).toBeLessThan(
      fetchPixelbotMock.mock.invocationCallOrder[0]
    );
  });

  test("un número no permitido produce CERO llamadas a PixelBot", async () => {
    whatsappGuardMock.mockImplementationOnce(() => {
      throw new EgressBlockedError({
        channel: "whatsapp",
        operation: "send",
        reason: "target_not_allowed",
      });
    });

    const res = await (await import("./send/route")).POST(
      req("/api/whatsapp-inbox/send", {
        method: "POST",
        body: { phone: "+5219999999999", text: "hola, este es el mensaje real" },
      })
    );
    const body = await res.json();

    expect(fetchPixelbotMock).not.toHaveBeenCalled();
    expect(res.status).toBe(503);
    expect(body.code).toBe("egress_blocked");
  });

  test("ni el teléfono ni el mensaje aparecen en el error", async () => {
    whatsappGuardMock.mockImplementationOnce(() => {
      throw new EgressBlockedError({
        channel: "whatsapp",
        operation: "send",
        reason: "target_not_allowed",
      });
    });

    const res = await (await import("./send/route")).POST(
      req("/api/whatsapp-inbox/send", {
        method: "POST",
        body: { phone: "+5219999999999", text: "hola, este es el mensaje real" },
      })
    );
    const crudo = JSON.stringify(await res.json());

    expect(crudo).not.toContain("+5219999999999");
    expect(crudo).not.toContain("hola, este es el mensaje real");
  });
});

describe("validación de entrada previa al cliente", () => {
  test("examples/[id]/active rechaza un id no numérico sin llamar a PixelBot", async () => {
    const res = await (await import("./examples/[id]/active/route")).POST(
      req("/api/whatsapp-inbox/examples/x/active", { method: "POST", body: { active: true } }),
      { params: Promise.resolve({ id: "1/../../admin" }) }
    );

    expect(res.status).toBe(400);
    expect(fetchPixelbotMock).not.toHaveBeenCalled();
  });

  test("examples/[id]/active codifica el id al construir la ruta interna", async () => {
    await (await import("./examples/[id]/active/route")).POST(
      req("/api/whatsapp-inbox/examples/7/active", { method: "POST", body: { active: false } }),
      { params: Promise.resolve({ id: "7" }) }
    );

    expect(fetchPixelbotMock).toHaveBeenCalledWith(
      "/internal/examples/7/active",
      { active: false },
      "POST"
    );
  });
});
