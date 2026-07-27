import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Gate B1 de la remediación de identidad.
 *
 * Lo que se protege: que Hoy y Proyectos resuelvan por `users.id` y que el
 * traductor `WHERE firebase_uid = uid` haya desaparecido del bloque. El defecto
 * original dejaba a toda cuenta sin puente con listas vacías o en bucle de
 * login, pese a tener sesión válida.
 *
 * Va en archivo propio y no en `crm-data.test.ts`, que ya existe y cubre la
 * agregación de proyectos: son contratos distintos.
 *
 * Entorno Node — aquí no se renderiza nada, son datos y sesión.
 */

const OWNER_A = "aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa";
const OWNER_B = "bbbbbbbb-2222-4bbb-8bbb-bbbbbbbbbbbb";
const OWNER_INEXISTENTE = "cccccccc-3333-4ccc-8ccc-cccccccccccc";
const LEGACY_UID = "jO09XxAbCdEfGhIjKlMnOpQrStUv";

/** CRM sintético: cada propietario tiene clientes propios y disjuntos. */
const CRM_POR_OWNER: Record<string, Array<{ id: string; name: string }>> = {
  [OWNER_A]: [
    { id: "cli-a1", name: "Cliente A1" },
    { id: "cli-a2", name: "Cliente A2" },
  ],
  [OWNER_B]: [{ id: "cli-b1", name: "Cliente B1" }],
};

const getFullCrmDataMock = vi.fn(async (ownerId: string) => ({
  clients: CRM_POR_OWNER[ownerId] ?? [],
  tools: [],
  streak: 0,
  serverLinks: {},
  sessions: [],
}));

// Espía sobre la capa de base: si algo del bloque volviera a traducir por
// `users.firebase_uid`, tendría que pasar por aquí y el test lo delataría.
const dbSelectMock = vi.fn();

vi.mock("@/lib/db/repos/crm-sync", () => ({
  getFullCrmData: (ownerId: string) => getFullCrmDataMock(ownerId),
}));
vi.mock("@/lib/db", () => ({
  db: { select: (...args: unknown[]) => dbSelectMock(...args) },
}));

const sessionMock = vi.fn();
vi.mock("@/lib/auth/config", () => ({ auth: () => sessionMock() }));

// Los otros dos repos de Proyectos ya recibían ownerId; se neutralizan para
// aislar la fuente CRM, que es la que cambia de contrato.
vi.mock("@/lib/db/repos/pixelforge", () => ({ listPixelforgeProjectsByOwner: async () => [] }));
vi.mock("@/lib/db/repos/definitions", () => ({ listDefinitionsByOwner: async () => [] }));

const { getCrmClientsByOwnerId } = await import("./crm-data");
const sessionModule = await import("@/lib/auth/session");
const { getTodayData } = await import("@/app/(admin)/hoy/actions");
const { getAllActiveProjects } = await import("@/app/(admin)/proyectos/actions");

/** Sesión de cuenta anterior a la migración: conserva el alias heredado. */
const sesionConPuente = (id: string) => ({ user: { id, role: "admin", firebaseUid: LEGACY_UID } });
/** Sesión de cuenta creada después: sin alias. Es el caso que estaba roto. */
const sesionSinPuente = (id: string) => ({ user: { id, role: "admin", firebaseUid: null } });

beforeEach(() => {
  getFullCrmDataMock.mockClear();
  dbSelectMock.mockClear();
  sessionMock.mockReset();
});

describe("getCrmClientsByOwnerId", () => {
  it("consulta directamente por ownerId, sin traducir", async () => {
    const clients = await getCrmClientsByOwnerId(OWNER_A);
    expect(getFullCrmDataMock).toHaveBeenCalledWith(OWNER_A);
    expect(clients.map((c) => c.id)).toEqual(["cli-a1", "cli-a2"]);
  });

  it("no toca la capa de base para resolver identidad", async () => {
    await getCrmClientsByOwnerId(OWNER_A);
    expect(dbSelectMock).not.toHaveBeenCalled();
  });

  it("un ownerId inexistente devuelve vacío, nunca datos de otro propietario", async () => {
    const clients = await getCrmClientsByOwnerId(OWNER_INEXISTENTE);
    expect(clients).toEqual([]);
  });

  it("aísla propietarios: cada uno recibe solo lo suyo", async () => {
    const a = await getCrmClientsByOwnerId(OWNER_A);
    const b = await getCrmClientsByOwnerId(OWNER_B);
    expect(a.map((c) => c.id)).toEqual(["cli-a1", "cli-a2"]);
    expect(b.map((c) => c.id)).toEqual(["cli-b1"]);
    expect(a.some((c) => b.some((x) => x.id === c.id))).toBe(false);
  });
});

describe("Hoy — getTodayData", () => {
  it("resuelve por session.user.id con cuenta heredada", async () => {
    sessionMock.mockResolvedValue(sesionConPuente(OWNER_A));
    const data = await getTodayData();
    expect(getFullCrmDataMock).toHaveBeenCalledWith(OWNER_A);
    expect(data?.clients).toHaveLength(2);
  });

  it("funciona con cuenta SIN firebase_uid — el defecto que se corrige", async () => {
    sessionMock.mockResolvedValue(sesionSinPuente(OWNER_A));
    const data = await getTodayData();
    expect(getFullCrmDataMock).toHaveBeenCalledWith(OWNER_A);
    expect(data?.clients).toHaveLength(2);
  });

  it("con y sin puente devuelve exactamente los mismos datos", async () => {
    sessionMock.mockResolvedValue(sesionConPuente(OWNER_A));
    const conPuente = await getTodayData();
    sessionMock.mockResolvedValue(sesionSinPuente(OWNER_A));
    const sinPuente = await getTodayData();
    expect(sinPuente?.clients).toEqual(conPuente?.clients);
    expect(sinPuente?.projects).toEqual(conPuente?.projects);
  });

  it("sin sesión devuelve null", async () => {
    sessionMock.mockResolvedValue(null);
    await expect(getTodayData()).resolves.toBeNull();
  });

  it("no cruza datos entre propietarios", async () => {
    sessionMock.mockResolvedValue(sesionSinPuente(OWNER_B));
    const data = await getTodayData();
    expect(data?.clients.map((c) => c.id)).toEqual(["cli-b1"]);
  });
});

describe("Proyectos — getAllActiveProjects", () => {
  it("resuelve por session.user.id con cuenta heredada", async () => {
    sessionMock.mockResolvedValue(sesionConPuente(OWNER_A));
    await getAllActiveProjects();
    expect(getFullCrmDataMock).toHaveBeenCalledWith(OWNER_A);
  });

  it("funciona con cuenta SIN firebase_uid — antes devolvía [] aunque hubiera datos", async () => {
    sessionMock.mockResolvedValue(sesionSinPuente(OWNER_A));
    const proyectos = await getAllActiveProjects();
    expect(getFullCrmDataMock).toHaveBeenCalledWith(OWNER_A);
    expect(Array.isArray(proyectos)).toBe(true);
  });

  it("sin sesión devuelve lista vacía", async () => {
    sessionMock.mockResolvedValue(null);
    await expect(getAllActiveProjects()).resolves.toEqual([]);
  });

  it("no cruza datos entre propietarios", async () => {
    sessionMock.mockResolvedValue(sesionSinPuente(OWNER_B));
    await getAllActiveProjects();
    expect(getFullCrmDataMock).toHaveBeenCalledWith(OWNER_B);
    expect(getFullCrmDataMock).not.toHaveBeenCalledWith(OWNER_A);
  });
});

describe("código muerto retirado", () => {
  it("el módulo de sesión ya no exporta requireAdmin", () => {
    expect("requireAdmin" in sessionModule).toBe(false);
  });

  it("sigue exportando la resolución canónica y la heredada", () => {
    expect(typeof sessionModule.getSessionUserId).toBe("function");
    expect(typeof sessionModule.getSessionUid).toBe("function");
  });
});
