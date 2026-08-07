import { describe, expect, test, vi, beforeEach } from "vitest";

/**
 * `createInvoice` — regresión de la revisión de PR #98 (iteración 3, item 2):
 * el folio es server-owned, asignado dentro de la transacción bajo advisory
 * lock, usando MAX del sufijo (no COUNT) para no reutilizar un número ante
 * un hueco. `data.number` del payload nunca se usa.
 */

const OWNER_ID = "owner-1";
const CLIENT_PG_ID = "client-pg-1";
const INVOICE_PG_ID = "invoice-pg-1";
const YEAR = new Date("2026-08-06").getFullYear();

const mocks = vi.hoisted(() => {
  const execute = vi.fn(async () => undefined);

  const selectWhere = vi.fn();
  const selectFrom = vi.fn(() => ({ where: selectWhere }));
  const select = vi.fn(() => ({ from: selectFrom }));

  let insertCallCount = 0;
  const invoicesReturning = vi.fn(async () => [{ id: INVOICE_PG_ID }]);
  const invoicesValues = vi.fn((_values: { number: string }) => ({ returning: invoicesReturning }));
  const itemsValues = vi.fn(async (_values: unknown) => undefined);
  const insert = vi.fn(() => {
    insertCallCount += 1;
    if (insertCallCount === 1) return { values: invoicesValues };
    return { values: itemsValues };
  });

  const tx = { execute, select, insert };
  const db = { transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)) };

  return {
    requireOwner: vi.fn(),
    resolveOwnedClientPgId: vi.fn(),
    logClientActivity: vi.fn(async () => undefined),
    db,
    execute,
    select,
    selectWhere,
    insert,
    invoicesValues,
    invoicesReturning,
    itemsValues,
    resetInsertCounter: () => {
      insertCallCount = 0;
    },
  };
});

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("./pg", () => ({
  requireOwner: mocks.requireOwner,
  resolveOwnedClientPgId: mocks.resolveOwnedClientPgId,
  resolveClientPgId: vi.fn(),
  resolveInvoiceRow: vi.fn(),
  serializeInvoice: vi.fn(),
  orderedItemIds: (n: number) => Array.from({ length: n }, (_, i) => `item-${i}`),
}));
vi.mock("@/lib/db/repos/client-activity", () => ({ logClientActivity: mocks.logClientActivity }));

const { createInvoice } = await import("./invoices");

const BASE_DATA = {
  number: "FAC-CLIENTE-SUGERIDO-999", // lo que manda el cliente — debe ignorarse por completo
  status: "borrador" as const,
  items: [{ id: "i1", description: "Servicio", qty: 1, unitPrice: 1000, subtotal: 1000 }],
  subtotal: 1000,
  ivaRate: 0.16,
  ivaAmount: 160,
  total: 1160,
  currency: "MXN" as const,
  issueDate: "2026-08-06",
  dueDate: "2026-08-06",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resetInsertCounter();
  mocks.requireOwner.mockResolvedValue({ uid: "u1", ownerId: OWNER_ID });
  mocks.resolveOwnedClientPgId.mockResolvedValue(CLIENT_PG_ID);
  mocks.selectWhere.mockResolvedValue([]);
});

describe("createInvoice — folio server-owned", () => {
  test("ignora data.number del payload por completo, incluso en el log de actividad", async () => {
    mocks.selectWhere.mockResolvedValue([]); // ninguna factura previa este año

    await createInvoice("u1", "client-pub", BASE_DATA);

    const insertedInvoice = mocks.invoicesValues.mock.calls[0][0] as { number: string };
    expect(insertedInvoice.number).not.toBe(BASE_DATA.number);
    expect(insertedInvoice.number).toMatch(/^FAC-\d{4}-001$/);
    expect(mocks.logClientActivity).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining(insertedInvoice.number) }),
    );
  });

  test("adquiere el advisory lock ANTES de leer los folios existentes", async () => {
    await createInvoice("u1", "client-pub", BASE_DATA);

    expect(mocks.execute).toHaveBeenCalledTimes(1);
    expect(mocks.select).toHaveBeenCalledTimes(1);
    const lockOrder = mocks.execute.mock.invocationCallOrder[0];
    const selectOrder = mocks.select.mock.invocationCallOrder[0];
    expect(lockOrder).toBeLessThan(selectOrder);
  });

  test("usa MAX del sufijo, no COUNT: un hueco (FAC-<año>-002 eliminada) no se reutiliza", async () => {
    mocks.selectWhere.mockResolvedValue([
      { number: `FAC-${YEAR}-001` },
      { number: `FAC-${YEAR}-005` }, // hueco: 002-004 no existen (eliminadas/renumeradas)
    ]);

    await createInvoice("u1", "client-pub", BASE_DATA);

    const insertedInvoice = mocks.invoicesValues.mock.calls[0][0] as { number: string };
    // MAX=5 -> el siguiente es 006, NUNCA 003 (que sería reutilizar con COUNT=2+1).
    expect(insertedInvoice.number).toBe(`FAC-${YEAR}-006`);
  });

  test("ignora folios de OTROS años al calcular el siguiente (like por año)", async () => {
    mocks.selectWhere.mockResolvedValue([{ number: `FAC-${YEAR}-042` }]);

    await createInvoice("u1", "client-pub", BASE_DATA);

    const insertedInvoice = mocks.invoicesValues.mock.calls[0][0] as { number: string };
    expect(insertedInvoice.number).toBe(`FAC-${YEAR}-043`);
  });
});
