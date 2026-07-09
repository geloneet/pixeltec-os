import { describe, expect, test } from "vitest";
import { computeNextDueDate, isOverdue } from "./next-due";

describe("computeNextDueDate", () => {
  test("unico frequency has no next due date", () => {
    expect(computeNextDueDate("2026-01-15", "unico")).toBeNull();
  });

  test("mensual advances by one month", () => {
    expect(computeNextDueDate("2026-01-15", "mensual")).toBe("2026-02-15");
  });

  test("trimestral advances by three months", () => {
    expect(computeNextDueDate("2026-01-15", "trimestral")).toBe("2026-04-15");
  });

  test("semestral advances by six months", () => {
    expect(computeNextDueDate("2026-01-15", "semestral")).toBe("2026-07-15");
  });

  test("anual advances by one year", () => {
    expect(computeNextDueDate("2026-01-15", "anual")).toBe("2027-01-15");
  });

  test("mensual clips to end of shorter month instead of overflowing", () => {
    expect(computeNextDueDate("2026-01-31", "mensual")).toBe("2026-02-28");
  });

  test("anual on a leap day clips to Feb 28 the following non-leap year", () => {
    expect(computeNextDueDate("2024-02-29", "anual")).toBe("2025-02-28");
  });

  test("date-only strings do not shift a day due to UTC parsing", () => {
    // Regression guard for the off-by-one bug documented in
    // src/lib/crm/next-charge-date.ts: passing "YYYY-MM-DD" straight to
    // `new Date(...)` interprets it as UTC midnight, which in negative-UTC
    // offsets rolls back to the previous local day.
    expect(computeNextDueDate("2026-03-01", "mensual")).toBe("2026-04-01");
  });
});

describe("isOverdue", () => {
  const today = new Date("2026-06-15T12:00:00");

  test("una fecha de vencimiento pasada está vencida", () => {
    expect(isOverdue("2026-06-01", today)).toBe(true);
  });

  test("una fecha de vencimiento futura no está vencida", () => {
    expect(isOverdue("2026-07-01", today)).toBe(false);
  });

  test("el día mismo del vencimiento no cuenta como vencido todavía", () => {
    expect(isOverdue("2026-06-15", today)).toBe(false);
  });
});
