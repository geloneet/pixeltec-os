import { describe, expect, test, vi, beforeEach } from "vitest";

/**
 * `recordPayment` — regresión de la revisión de PR #98:
 * 1. Lock `FOR UPDATE` sobre `billing_items` antes de leer pagos del período
 *    (sin él, dos pagos concurrentes pisan el estado uno del otro).
 * 2. Rechazo de sobrepago: sin decisión de negocio que soporte créditos, un
 *    pago que exceda el saldo restante del período se rechaza.
 */

const ROW_ID = "billing-item-1";
const OWNER_ID = "owner-1";

const mocks = vi.hoisted(() => {
  const billingSelectFor = vi.fn();
  const billingSelectLimit = vi.fn(() => ({ for: billingSelectFor }));
  const billingSelectWhere = vi.fn(() => ({ limit: billingSelectLimit }));

  const paymentsSelectWhere = vi.fn();

  // Primer .select() del tx = billingItems (con lock); segundo = paymentRecords.
  let selectCallCount = 0;
  const select = vi.fn(() => {
    selectCallCount += 1;
    if (selectCallCount % 2 === 1) {
      return { from: vi.fn(() => ({ where: billingSelectWhere })) };
    }
    return { from: vi.fn(() => ({ where: paymentsSelectWhere })) };
  });

  const insertValues = vi.fn(async () => undefined);
  const insert = vi.fn(() => ({ values: insertValues }));

  const updateWhere = vi.fn(async () => undefined);
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set: updateSet }));

  const tx = { select, insert, update };
  const db = { transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)) };

  return {
    requireOwner: vi.fn(),
    resolveClientPgId: vi.fn(),
    db,
    tx,
    billingSelectFor,
    billingSelectWhere,
    paymentsSelectWhere,
    insert,
    insertValues,
    update,
    updateSet,
    updateWhere,
    resetSelectCounter: () => {
      selectCallCount = 0;
    },
  };
});

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("./pg", () => ({
  requireOwner: mocks.requireOwner,
  resolveClientPgId: mocks.resolveClientPgId,
}));

const { recordPayment } = await import("./billing");

function armRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: ROW_ID,
    ownerId: OWNER_ID,
    status: "pendiente",
    frequency: "mensual",
    dueDate: "2026-08-01",
    amount: "1000.00",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resetSelectCounter();
  mocks.requireOwner.mockResolvedValue({ uid: "u1", ownerId: OWNER_ID });
  mocks.billingSelectFor.mockResolvedValue([armRow()]);
  mocks.paymentsSelectWhere.mockResolvedValue([]);
});

describe("recordPayment — lock FOR UPDATE", () => {
  test("bloquea billing_items con FOR UPDATE antes de leer pagos del período", async () => {
    await recordPayment(ROW_ID, { amount: 500, method: "transferencia", paidAt: "2026-08-06" });

    expect(mocks.billingSelectWhere).toHaveBeenCalled();
    // .limit(1).for("update") — el lock se pide como parte de la misma cadena.
    expect(mocks.billingSelectFor).toHaveBeenCalledWith("update");
  });

  test("dos pagos concurrentes sobre el mismo período: el segundo ve el pago del primero (serializado por el lock) y no lo duplica", async () => {
    // Simula lo que Postgres garantiza con FOR UPDATE: el segundo `recordPayment`
    // solo lee después de que el primero commiteó, así que su `paidThisPeriod`
    // YA incluye el pago del primero.
    mocks.paymentsSelectWhere.mockResolvedValueOnce([]); // pago #1: nadie ha pagado aún
    const first = await recordPayment(ROW_ID, {
      amount: 600,
      method: "transferencia",
      paidAt: "2026-08-06",
    });
    expect(first.remaining).toBe(400);

    mocks.paymentsSelectWhere.mockResolvedValueOnce([
      { billingItemId: ROW_ID, amount: "600.00", periodKey: "2026-08-01" },
    ]); // pago #2: ya ve el pago #1 registrado
    const second = await recordPayment(ROW_ID, {
      amount: 400,
      method: "transferencia",
      paidAt: "2026-08-06",
    });
    expect(second.fullyPaid).toBe(true);
    expect(second.remaining).toBe(0);
  });
});

describe("recordPayment — rechazo de sobrepago", () => {
  test("un pago individual superior al saldo se rechaza sin escribir nada", async () => {
    mocks.paymentsSelectWhere.mockResolvedValue([]);

    await expect(
      recordPayment(ROW_ID, { amount: 1500, method: "transferencia", paidAt: "2026-08-06" }),
    ).rejects.toThrow(/excede el saldo pendiente/);

    expect(mocks.insertValues).not.toHaveBeenCalled();
    expect(mocks.updateSet).not.toHaveBeenCalled();
  });

  test("un pago que excede el saldo RESTANTE (tras un parcial previo) también se rechaza", async () => {
    mocks.paymentsSelectWhere.mockResolvedValue([
      { billingItemId: ROW_ID, amount: "700.00", periodKey: "2026-08-01" },
    ]);

    await expect(
      recordPayment(ROW_ID, { amount: 400, method: "transferencia", paidAt: "2026-08-06" }),
    ).rejects.toThrow(/excede el saldo pendiente/);

    expect(mocks.insertValues).not.toHaveBeenCalled();
  });

  test("un pago exacto al saldo restante SÍ se acepta (no rechaza por redondeo de punto flotante)", async () => {
    mocks.billingSelectFor.mockResolvedValue([armRow({ amount: "99.99" })]);
    mocks.paymentsSelectWhere.mockResolvedValue([]);

    const result = await recordPayment(ROW_ID, {
      amount: 99.99,
      method: "transferencia",
      paidAt: "2026-08-06",
    });

    expect(result.fullyPaid).toBe(true);
  });
});
