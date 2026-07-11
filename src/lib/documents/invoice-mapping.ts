// Mapeo puro billing item -> item de factura, testeado sin DB. Cada billing
// item genera un item de factura de cantidad 1 (el monto del cobro es el
// unitPrice/subtotal completo, no una tarifa unitaria por cantidad).
export function buildInvoiceItemFromBillingItem(
  billingItem: { concept: string; amount: number },
): { description: string; qty: number; unitPrice: number; subtotal: number } {
  return {
    description: billingItem.concept,
    qty: 1,
    unitPrice: billingItem.amount,
    subtotal: billingItem.amount,
  };
}
