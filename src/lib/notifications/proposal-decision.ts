// Textos de las notificaciones de decisión de propuesta (WhatsApp / email /
// in-app). Función pura para testear el copy sin DB ni red — la dispara
// src/app/api/proposals/action/route.ts.
import type { BillingItemDraft } from "@/types/documents";

export interface ProposalDecisionInput {
  action: "aceptada" | "rechazada";
  title: string;
  clientName: string;
  billingItemDrafts?: BillingItemDraft[];
}

export interface ProposalDecisionMessages {
  whatsappText: string;
  emailSubject: string;
  inApp: { type: "success" | "warning"; title: string; body: string };
}

/** Resumen de la inversión: "$5,999 MXN único + 2 conceptos recurrentes".
 * Cadena vacía si no hay conceptos con nombre y monto. */
export function investmentSummary(drafts: BillingItemDraft[] | undefined): string {
  const items = (drafts ?? []).filter((d) => d.concept && d.amount > 0);
  if (items.length === 0) return "";
  const unique = items.filter((d) => d.frequency === "unico").reduce((s, d) => s + d.amount, 0);
  const recurring = items.filter((d) => d.frequency !== "unico").length;
  const parts: string[] = [];
  if (unique > 0) parts.push(`$${unique.toLocaleString("es-MX")} MXN único`);
  if (recurring > 0) parts.push(`${recurring} concepto${recurring === 1 ? "" : "s"} recurrente${recurring === 1 ? "" : "s"}`);
  return parts.join(" + ");
}

export function buildProposalDecisionNotification(input: ProposalDecisionInput): ProposalDecisionMessages {
  const client = input.clientName.trim() || "Un cliente";
  const accepted = input.action === "aceptada";
  const verb = accepted ? "aceptó" : "rechazó";
  // El monto solo aporta en la aceptación; en el rechazo es ruido.
  const summary = accepted ? investmentSummary(input.billingItemDrafts) : "";
  const money = summary ? ` — ${summary}` : "";

  return {
    whatsappText: `${accepted ? "✅" : "❌"} ${client} ${verb} la propuesta «${input.title}»${money}\n👉 pixeltec.mx/crm`,
    emailSubject: `${accepted ? "✅" : "❌"} Propuesta ${input.action}: ${input.title} — ${client}`,
    inApp: {
      type: accepted ? "success" : "warning",
      title: `Propuesta ${input.action}`,
      body: `${client} ${verb} «${input.title}».`,
    },
  };
}
