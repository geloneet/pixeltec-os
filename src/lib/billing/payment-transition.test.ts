import { describe, expect, test } from "vitest";
import { computePaymentTransition } from "./payment-transition";

describe("computePaymentTransition", () => {
  test("pago único completo marca pagado y no genera próximo cobro", () => {
    const result = computePaymentTransition(
      { frequency: "unico", dueDate: "2026-03-01", amountDue: 25000, amountPaidSoFar: 0 },
      25000,
    );
    expect(result).toEqual({
      status: "pagado",
      dueDate: "2026-03-01",
      nextDueDate: null,
      fullyPaid: true,
    });
  });

  test("pago recurrente completo avanza dueDate y recalcula nextDueDate, vuelve a pendiente", () => {
    const result = computePaymentTransition(
      { frequency: "anual", dueDate: "2026-01-15", amountDue: 1500, amountPaidSoFar: 0 },
      1500,
    );
    expect(result).toEqual({
      status: "pendiente",
      dueDate: "2027-01-15",
      nextDueDate: "2028-01-15",
      fullyPaid: true,
    });
  });

  test("pago parcial deja status parcial y conserva el dueDate del período actual", () => {
    const result = computePaymentTransition(
      { frequency: "anual", dueDate: "2026-01-15", amountDue: 1500, amountPaidSoFar: 0 },
      500,
    );
    expect(result).toEqual({
      status: "parcial",
      dueDate: "2026-01-15",
      nextDueDate: "2027-01-15",
      fullyPaid: false,
    });
  });

  test("un segundo pago parcial que completa el adeudo del período sí avanza", () => {
    const result = computePaymentTransition(
      { frequency: "mensual", dueDate: "2026-01-15", amountDue: 1500, amountPaidSoFar: 500 },
      1000,
    );
    expect(result.fullyPaid).toBe(true);
    expect(result.status).toBe("pendiente");
    expect(result.dueDate).toBe("2026-02-15");
  });

  test("un sobrepago se trata como completo (no genera saldo a favor)", () => {
    const result = computePaymentTransition(
      { frequency: "unico", dueDate: "2026-03-01", amountDue: 1500, amountPaidSoFar: 0 },
      2000,
    );
    expect(result.fullyPaid).toBe(true);
    expect(result.status).toBe("pagado");
  });

  test("rechaza montos de pago no positivos", () => {
    expect(() =>
      computePaymentTransition(
        { frequency: "unico", dueDate: "2026-03-01", amountDue: 1500, amountPaidSoFar: 0 },
        0,
      ),
    ).toThrow();
    expect(() =>
      computePaymentTransition(
        { frequency: "unico", dueDate: "2026-03-01", amountDue: 1500, amountPaidSoFar: 0 },
        -100,
      ),
    ).toThrow();
  });
});
