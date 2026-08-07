import { describe, expect, test, vi, beforeEach } from "vitest";

/**
 * `updateInvoice` — regresión de la revisión de PR #98 (item 6): la
 * validación de transición de estado debe correr sobre el status REAL en el
 * momento del commit (bajo lock), no sobre un `row` leído antes de abrir la
 * transacción — sin esto, una request concurrente podía pisar en silencio
 * una transición terminal (pagada/cancelada) ya aplicada por otra.
 */

const INVOICE_PG_ID = "invoice-pg-1";
const OWNER_ID = "owner-1";

const mocks = vi.hoisted(() => {
  const selectFor = vi.fn();
  const selectLimit = vi.fn(() => ({ for: selectFor }));
  const selectWhere = vi.fn(() => ({ limit: selectLimit }));
  const selectFrom = vi.fn(() => ({ where: selectWhere }));
  const select = vi.fn(() => ({ from: selectFrom }));

  const updateWhere = vi.fn(async () => undefined);
  const updateSet = vi.fn((_set: Record<string, unknown>) => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set: updateSet }));

  const tx = { select, update, insert: vi.fn(), delete: vi.fn() };
  const db = { transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)) };

  return {
    resolveInvoiceRow: vi.fn(),
    requireOwner: vi.fn(),
    db,
    select,
    selectFor,
    selectLimit,
    update,
    updateSet,
  };
});

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("./pg", () => ({
  requireOwner: mocks.requireOwner,
  resolveInvoiceRow: mocks.resolveInvoiceRow,
}));
vi.mock("@/lib/db/repos/client-activity", () => ({ logClientActivity: vi.fn(async () => undefined) }));

const { updateInvoice } = await import("./invoices");

function invoiceRow(status: string, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: INVOICE_PG_ID,
    ownerId: OWNER_ID,
    clientId: "client-pg-1",
    status,
    ivaRate: "0.16",
    number: "FAC-2026-001",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireOwner.mockResolvedValue({ uid: "u1", ownerId: OWNER_ID });
  mocks.resolveInvoiceRow.mockResolvedValue({ id: INVOICE_PG_ID, ownerId: OWNER_ID });
});

describe("updateInvoice — lock dentro de la transacción", () => {
  test("relee con FOR UPDATE dentro del tx, no confía en un row externo", async () => {
    mocks.selectFor.mockResolvedValue([invoiceRow("enviada")]);

    await updateInvoice("invoice-pub", { status: "pagada" });

    expect(mocks.select).toHaveBeenCalled();
    expect(mocks.selectFor).toHaveBeenCalledWith("update");
    expect(mocks.updateSet).toHaveBeenCalledWith(expect.objectContaining({ status: "pagada" }));
  });
});

describe("updateInvoice — el folio es inmutable", () => {
  test("el tipo de `data` excluye `number` (verificado en tiempo de compilación)", () => {
    // @ts-expect-error — number no es un campo válido de updateInvoice; si
    // esto deja de fallar en tsc, alguien reabrió el hueco en el tipo.
    const _shouldNotCompile: Parameters<typeof updateInvoice>[1] = { number: "FAC-2026-999" };
    expect(_shouldNotCompile).toBeDefined();
  });

  test("incluso forzando el tipo (bypass en runtime), 'number' nunca llega al SET del UPDATE", async () => {
    mocks.selectFor.mockResolvedValue([invoiceRow("enviada")]);

    await updateInvoice("invoice-pub", { status: "pagada", number: "FAC-2026-999" } as never);

    const setArg = mocks.updateSet.mock.calls[0][0] as Record<string, unknown>;
    expect(setArg).not.toHaveProperty("number");
  });
});

describe("updateInvoice — transición concurrente no pisa un estado terminal", () => {
  test("una request que validó sobre 'enviada' pero relee 'cancelada' bajo el lock: rechaza la transición, no la aplica", async () => {
    // La request concurrió con otra que YA transicionó a 'cancelada' (terminal)
    // antes de que esta adquiriera el lock — lo que ve DENTRO del tx es lo real.
    mocks.selectFor.mockResolvedValue([invoiceRow("cancelada")]);

    await expect(updateInvoice("invoice-pub", { status: "pagada" })).rejects.toThrow(
      /Transición de factura inválida: cancelada → pagada/,
    );
    expect(mocks.updateSet).not.toHaveBeenCalled();
  });

  test("caso feliz: transición válida bajo el estado real sí se aplica", async () => {
    mocks.selectFor.mockResolvedValue([invoiceRow("enviada")]);

    await updateInvoice("invoice-pub", { status: "pagada" });

    expect(mocks.updateSet).toHaveBeenCalledWith(expect.objectContaining({ status: "pagada" }));
  });

  test("dos requests concurrentes: la primera transiciona a 'pagada' (terminal); la segunda, serializada por el lock, ve 'pagada' y su intento de volver a 'borrador' se rechaza", async () => {
    mocks.selectFor.mockResolvedValueOnce([invoiceRow("enviada")]);
    await updateInvoice("invoice-pub", { status: "pagada" });
    expect(mocks.updateSet).toHaveBeenCalledTimes(1);

    mocks.selectFor.mockResolvedValueOnce([invoiceRow("pagada")]);
    await expect(updateInvoice("invoice-pub", { status: "borrador" as never })).rejects.toThrow(
      /Transición de factura inválida: pagada → borrador/,
    );
    expect(mocks.updateSet).toHaveBeenCalledTimes(1); // no creció con el segundo intento
  });
});
