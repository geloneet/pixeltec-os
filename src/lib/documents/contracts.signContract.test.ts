import { describe, expect, test, vi, beforeEach } from "vitest";

/**
 * `signContract` — regresión de la revisión de PR #98 (item 8):
 * `logClientActivity(contrato_firmado)` debe dispararse UNA sola vez, solo
 * por la request que realmente ganó la carrera y escribió la transición —
 * no por cada click concurrente que entró a la transacción.
 */

const CONTRACT_PG_ID = "contract-pg-1";
const OWNER_ID = "owner-1";

const mocks = vi.hoisted(() => {
  const selectFor = vi.fn();
  // contracts.ts usa .where().for("update") sin .limit() en este select.
  const selectWhere = vi.fn(() => ({ for: selectFor }));
  const selectFrom = vi.fn(() => ({ where: selectWhere }));
  const select = vi.fn(() => ({ from: selectFrom }));

  const updateWhere = vi.fn(async () => undefined);
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set: updateSet }));

  const tx = { select, update };
  const db = { transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)) };

  return {
    requireOwner: vi.fn(),
    resolveContractRow: vi.fn(),
    createBillingItemsForContract: vi.fn(async () => undefined),
    logClientActivity: vi.fn(async () => undefined),
    db,
    select,
    selectFor,
    update,
    updateSet,
  };
});

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("./pg", () => ({
  requireOwner: mocks.requireOwner,
  resolveContractRow: mocks.resolveContractRow,
}));
vi.mock("./billing", () => ({ createBillingItemsForContract: mocks.createBillingItemsForContract }));
vi.mock("@/lib/db/repos/client-activity", () => ({ logClientActivity: mocks.logClientActivity }));

const { signContract } = await import("./contracts");

function contractRow(status: string) {
  return {
    id: CONTRACT_PG_ID,
    ownerId: OWNER_ID,
    clientId: "client-pg-1",
    proposalId: null,
    title: "Contrato de prueba",
    status,
    projectId: null,
    billingItemDrafts: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireOwner.mockResolvedValue({ uid: "u1", ownerId: OWNER_ID });
});

describe("signContract — actividad única por la request ganadora", () => {
  test("primera request gana la carrera: firma y registra actividad una vez", async () => {
    mocks.resolveContractRow.mockResolvedValue(contractRow("enviado"));
    mocks.selectFor.mockResolvedValue([{ status: "enviado" }]);

    const result = await signContract("contract-pub");

    expect(result.status).toBe("firmado");
    expect(mocks.updateSet).toHaveBeenCalledTimes(1);
    expect(mocks.createBillingItemsForContract).toHaveBeenCalledTimes(1);
    expect(mocks.logClientActivity).toHaveBeenCalledTimes(1);
  });

  test("segunda request pierde la carrera (relee 'firmado' bajo el lock): NO escribe ni registra actividad de nuevo", async () => {
    // El pre-check fuera del tx la deja pasar (todavía ve el status viejo),
    // pero dentro del tx, bajo el lock, ya está firmado.
    mocks.resolveContractRow.mockResolvedValue(contractRow("enviado"));
    mocks.selectFor.mockResolvedValue([{ status: "firmado" }]);

    const result = await signContract("contract-pub");

    expect(result.status).toBe("firmado");
    expect(mocks.updateSet).not.toHaveBeenCalled();
    expect(mocks.createBillingItemsForContract).not.toHaveBeenCalled();
    expect(mocks.logClientActivity).not.toHaveBeenCalled();
  });

  test("contrato ya firmado antes de abrir transacción: fast-path, sin actividad duplicada", async () => {
    mocks.resolveContractRow.mockResolvedValue(contractRow("firmado"));

    const result = await signContract("contract-pub");

    expect(result.status).toBe("firmado");
    expect(mocks.db.transaction).not.toHaveBeenCalled();
    expect(mocks.logClientActivity).not.toHaveBeenCalled();
  });
});
