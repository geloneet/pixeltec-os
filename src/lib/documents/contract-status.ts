import type { Contract } from "@/types/documents";

export function canSignContract(
  status: Contract["status"],
): { ok: true } | { ok: false; reason: "already_signed" | "cancelled" | "expired" } {
  if (status === "firmado") return { ok: false, reason: "already_signed" };
  if (status === "cancelado") return { ok: false, reason: "cancelled" };
  if (status === "vencido") return { ok: false, reason: "expired" };
  return { ok: true };
}
