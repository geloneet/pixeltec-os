import { describe, expect, test } from "vitest";
import { buildInvoiceItemFromBillingItem } from "./invoice-mapping";

describe("buildInvoiceItemFromBillingItem", () => {
  test("mapea concepto y monto a un item de factura de cantidad 1", () => {
    const result = buildInvoiceItemFromBillingItem({ concept: "Mantenimiento mensual", amount: 2500 });
    expect(result).toEqual({
      description: "Mantenimiento mensual",
      qty: 1,
      unitPrice: 2500,
      subtotal: 2500,
    });
  });
});
