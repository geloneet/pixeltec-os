import { describe, expect, test, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Campos server-owned de ADR-0034 (`crm_status`, `next_action`): las actions
 * dedicadas son su ÚNICA puerta de escritura, y el blob-sync jamás debe
 * poder pisarlos (decisión D2 del plan — un tab con blob stale reescribía
 * cualquier campo que entrara al `set` del upsert).
 */

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));

const dbMock = vi.hoisted(() => {
  const where = vi.fn(async () => undefined);
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));
  return { update, set, where };
});

const pgMock = vi.hoisted(() => ({ resolveClientPgId: vi.fn() }));

const activityMock = vi.hoisted(() => ({
  logClientActivity: vi.fn(async () => undefined),
  getClientActivityRows: vi.fn(async () => []),
}));

vi.mock("@/lib/auth/config", () => ({ auth: authMock }));
vi.mock("@/lib/db", () => ({ db: { update: dbMock.update } }));
vi.mock("@/lib/documents/pg", () => pgMock);
vi.mock("@/lib/db/repos/client-activity", () => activityMock);

import { setClientStatusAction, setClientNextActionAction } from "./crm-actions";

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  authMock.mockResolvedValue({ user: { id: "owner-1" } });
  pgMock.resolveClientPgId.mockResolvedValue("client-pg-1");
});

describe("setClientStatusAction", () => {
  test("escribe el estado y registra actividad estado_cambiado", async () => {
    const result = await setClientStatusAction("client-pub-1", "activo");

    expect(result).toEqual({ ok: true });
    expect(dbMock.set).toHaveBeenCalledWith({ crmStatus: "activo" });
    expect(activityMock.logClientActivity).toHaveBeenCalledWith(
      expect.objectContaining({ type: "estado_cambiado", clientId: "client-pg-1", ownerId: "owner-1" })
    );
  });

  test("estado inválido: falla sin tocar la base", async () => {
    const result = await setClientStatusAction("client-pub-1", "vip" as never);

    expect(result.ok).toBe(false);
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  test("cliente inexistente: fallback saneado, sin actividad", async () => {
    pgMock.resolveClientPgId.mockResolvedValue(null);

    const result = await setClientStatusAction("nope", "activo");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("No se pudo actualizar el estado del cliente.");
    expect(activityMock.logClientActivity).not.toHaveBeenCalled();
  });
});

describe("setClientNextActionAction", () => {
  test("recorta el label y registra seguimiento", async () => {
    const result = await setClientNextActionAction("client-pub-1", {
      label: "  Llamar al cliente  ",
      dueAt: "2026-08-12T00:00:00.000Z",
    });

    expect(result).toEqual({ ok: true });
    expect(dbMock.set).toHaveBeenCalledWith({
      nextAction: { label: "Llamar al cliente", dueAt: "2026-08-12T00:00:00.000Z" },
    });
    expect(activityMock.logClientActivity).toHaveBeenCalledWith(
      expect.objectContaining({ type: "seguimiento" })
    );
  });

  test("limpiar la próxima acción (null) no genera evento de seguimiento", async () => {
    const result = await setClientNextActionAction("client-pub-1", null);

    expect(result).toEqual({ ok: true });
    expect(dbMock.set).toHaveBeenCalledWith({ nextAction: null });
    expect(activityMock.logClientActivity).not.toHaveBeenCalled();
  });
});

describe("contrato anti-pisado (D2)", () => {
  test("syncCrmClients NO incluye crmStatus/nextAction en su upsert", () => {
    // Contrato a nivel fuente: si alguien agrega los campos server-owned al
    // values/set del blob-sync, cualquier tab stale volvería a pisarlos.
    const src = readFileSync(resolve(__dirname, "../../lib/db/repos/crm-sync.ts"), "utf8");
    const start = src.indexOf("export async function syncCrmClients");
    expect(start).toBeGreaterThan(-1);
    const end = src.indexOf("export async function", start + 1);
    const body = src.slice(start, end === -1 ? undefined : end);
    expect(body).not.toContain("crmStatus");
    expect(body).not.toContain("nextAction");
    expect(body).not.toContain("crm_status");
    expect(body).not.toContain("next_action");
  });
});
