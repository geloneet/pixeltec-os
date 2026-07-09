import { computeNextDueDate, type BillingFrequency } from "./next-due";

export type BillingStatus = "pendiente" | "pagado" | "vencido" | "parcial" | "cancelado";

export interface PaymentTransitionInput {
  frequency: BillingFrequency;
  /** Fecha de vencimiento del período actual (aún no se avanza). */
  dueDate: string;
  /** Monto adeudado para el período actual. */
  amountDue: number;
  /** Suma de pagos ya registrados para el período actual, antes de este pago. */
  amountPaidSoFar: number;
}

export interface PaymentTransitionResult {
  status: BillingStatus;
  dueDate: string;
  nextDueDate: string | null;
  fullyPaid: boolean;
}

/**
 * Transición de estado de un billing item al registrar un pago. Función
 * pura (sin acceso a datos) para poder testear la máquina de estados sin DB;
 * `src/lib/documents/billing.ts` la usa y persiste el resultado.
 */
export function computePaymentTransition(
  input: PaymentTransitionInput,
  paymentAmount: number,
): PaymentTransitionResult {
  if (paymentAmount <= 0) {
    throw new Error("El monto del pago debe ser mayor a cero");
  }

  const totalPaid = input.amountPaidSoFar + paymentAmount;
  const fullyPaid = totalPaid >= input.amountDue;

  if (!fullyPaid) {
    return {
      status: "parcial",
      dueDate: input.dueDate,
      nextDueDate: computeNextDueDate(input.dueDate, input.frequency),
      fullyPaid: false,
    };
  }

  if (input.frequency === "unico") {
    return { status: "pagado", dueDate: input.dueDate, nextDueDate: null, fullyPaid: true };
  }

  const nextDueDate = computeNextDueDate(input.dueDate, input.frequency) as string;
  return {
    status: "pendiente",
    dueDate: nextDueDate,
    nextDueDate: computeNextDueDate(nextDueDate, input.frequency),
    fullyPaid: true,
  };
}
