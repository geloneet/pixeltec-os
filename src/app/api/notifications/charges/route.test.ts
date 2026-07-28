import { describe, expect, test, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Superficie del cron de notificaciones de cobros.
 *
 * Su `try` cubre la consulta de usuarios, el recorrido completo del CRM y los
 * envíos de correo y WhatsApp: es el punto de los 21 con más superficie de base
 * de datos. Antes respondía `{ error: message }` desnudo, así que un fallo de
 * Drizzle citaba la consulta y los nombres de columna, y uno del proveedor, el
 * cuerpo de su respuesta.
 */

const { dbSelectMock, getFullCrmDataMock, sendEmailMock, sendWhatsAppMock } = vi.hoisted(() => ({
  dbSelectMock: vi.fn(),
  getFullCrmDataMock: vi.fn(),
  sendEmailMock: vi.fn(),
  sendWhatsAppMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: { select: dbSelectMock } }));
vi.mock("@/lib/db/schema", () => ({ users: {}, recurringCharges: {} }));
vi.mock("@/lib/db/repos/crm-sync", () => ({ getFullCrmData: getFullCrmDataMock }));
vi.mock("@/lib/email", () => ({ sendEmail: sendEmailMock }));
vi.mock("@/lib/whatsapp/sender", () => ({ sendWhatsApp: sendWhatsAppMock }));
vi.mock("@/lib/notifications/actions", () => ({ createNotification: vi.fn() }));
vi.mock("@/lib/crm/next-charge-date", () => ({ getNextChargeDate: vi.fn(() => new Date()) }));
vi.mock("@/lib/cron-guard", () => ({
  assertCronExecutionAllowed: vi.fn(),
  cronBlockedResponse: vi.fn(() => null),
}));

import { GET } from "./route";

const CRON_SECRET = "secreto-de-prueba";
const RAW_SQL = "SELECT id FROM users";
const ENV_SECRET_NAME = "DATABASE_URL";
const CLIENTE_CONFIDENCIAL = "Clínica Smile More — +5213221234567";

function makeRequest() {
  return new NextRequest("http://localhost/api/notifications/charges", {
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  });
}

/** `db.select({...}).from(users)` — la forma encadenada que usa el handler. */
function mockUsers(rows: Array<{ id: string }>) {
  dbSelectMock.mockReturnValue({ from: vi.fn().mockResolvedValue(rows) });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = CRON_SECRET;
  mockUsers([]);
  getFullCrmDataMock.mockResolvedValue({ clients: [] });
});

describe("GET /api/notifications/charges — el 500 no lleva el message ajeno", () => {
  test("un fallo de Drizzle no revela la consulta ni el esquema", async () => {
    dbSelectMock.mockImplementation(() => {
      throw Object.assign(new Error(`relation "users" does not exist`), {
        name: "PostgresError",
        code: "42P01",
        query: RAW_SQL,
      });
    });

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("No se pudieron procesar las notificaciones de cobros.");
    expect(body.code).toBe("charges_notification_failed");
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("relation");
    expect(serialized).not.toContain("SELECT");
    expect(serialized).not.toContain("42P01");
  });

  test("un fallo del repositorio de CRM no filtra datos de cliente", async () => {
    mockUsers([{ id: "user-1" }]);
    getFullCrmDataMock.mockRejectedValueOnce(
      new Error(`no se pudo leer el CRM de ${CLIENTE_CONFIDENCIAL}`)
    );

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("Smile More");
    expect(serialized).not.toContain("+5213221234567");
  });

  test("un fallo del proveedor de envío no propaga su texto", async () => {
    mockUsers([{ id: "user-1" }]);
    getFullCrmDataMock.mockRejectedValueOnce(
      new Error("Resend API failed (422): domain not verified — RESEND_API_KEY")
    );

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("Resend");
    expect(serialized).not.toContain("RESEND_API_KEY");
  });

  test("un error desconocido que nombra una variable de entorno tampoco pasa", async () => {
    dbSelectMock.mockImplementation(() => {
      throw new Error(`${ENV_SECRET_NAME} is not set`);
    });

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain(ENV_SECRET_NAME);
  });

  test("un valor lanzado que no es Error no acaba en la respuesta", async () => {
    // El patrón anterior lo pasaba por `String(error)`.
    dbSelectMock.mockImplementation(() => {
      throw `cadena suelta con ${RAW_SQL}`;
    });

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("cadena suelta");
    expect(JSON.stringify(body)).not.toContain("SELECT");
  });

  test("sin autorización responde 401 y no consulta la base", async () => {
    const res = await GET(new NextRequest("http://localhost/api/notifications/charges"));

    expect(res.status).toBe(401);
    expect(dbSelectMock).not.toHaveBeenCalled();
  });

  test("el contrato de éxito no cambia", async () => {
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, notificationsSent: 0, details: [] });
  });
});

/**
 * E0f-3b: `details` viaja en la respuesta JSON y antes interpolaba
 * `${result.error}` (texto de Resend) y `${e}` (throw desconocido). Ahora solo
 * llevan códigos: el de `EmailResult` (saneado en origen) o los propios de la
 * ruta.
 */
describe("GET /api/notifications/charges — details no lleva texto crudo (E0f-3b)", () => {
  function cobroActivo() {
    return {
      clients: [
        {
          id: "cl1",
          name: "Cliente Prueba",
          projects: [
            {
              id: "p1",
              name: "Proyecto",
              charges: [
                {
                  id: "c1",
                  active: true,
                  concept: "Hosting",
                  amount: "1000",
                  frequency: "monthly",
                  startDate: "2026-01-01",
                  clientEmail: "cliente@ejemplo.mx",
                  lastNotified: null,
                },
              ],
            },
          ],
        },
      ],
    };
  }

  async function correrConCobro() {
    mockUsers([{ id: "u1" }]);
    getFullCrmDataMock.mockResolvedValue(cobroActivo());
    const { getNextChargeDate } = await import("@/lib/crm/next-charge-date");
    // Mañana: daysUntil = 1 → un cobro mensual notifica.
    vi.mocked(getNextChargeDate).mockReturnValue(new Date(Date.now() + 20 * 3600 * 1000));
    sendWhatsAppMock.mockResolvedValue(undefined);
    return GET(makeRequest());
  }

  test("un EmailResult fallido interpola el código estable, no el texto de Resend", async () => {
    sendEmailMock.mockResolvedValue({ success: false, error: "email_provider_failed" });

    const res = await correrConCobro();
    const body = await res.json();

    expect(res.status).toBe(200);
    const details = (body.details as string[]).join(" | ");
    expect(details).toContain("Email FAILED to cliente@ejemplo.mx: email_provider_failed");
    expect(details).not.toContain("domain is not verified");
  });

  test("un throw del envío interpola email_send_threw, jamás el error", async () => {
    sendEmailMock.mockRejectedValue(
      Object.assign(new Error(`fallo con ${RAW_SQL} y ${CLIENTE_CONFIDENCIAL}`), {
        stack: "at sendEmail (/src/lib/email.ts:64:31)",
      })
    );

    const res = await correrConCobro();
    const body = await res.json();

    const details = (body.details as string[]).join(" | ");
    expect(details).toContain("Email FAILED to cliente@ejemplo.mx: email_send_threw");
    expect(details).not.toContain(RAW_SQL);
    expect(details).not.toContain(CLIENTE_CONFIDENCIAL);
    expect(details).not.toContain("/src/lib/email.ts");
  });
});
