import { describe, expect, it } from "vitest";
import { buildProposalDecisionNotification, investmentSummary } from "./proposal-decision";

const base = {
  action: "aceptada" as const,
  title: "Calculadora v2",
  clientName: "VillaNogal",
  billingItemDrafts: [
    { concept: "APP", amount: 5999, frequency: "unico" as const, dueDate: "2026-07-15" },
    { concept: "Mantenimiento", amount: 500, frequency: "trimestral" as const, dueDate: "2026-07-15" },
  ],
};

describe("investmentSummary", () => {
  it("suma únicos y cuenta recurrentes", () => {
    expect(investmentSummary(base.billingItemDrafts)).toBe("$5,999 MXN único + 1 concepto recurrente");
  });

  it("vacío/undefined → cadena vacía", () => {
    expect(investmentSummary([])).toBe("");
    expect(investmentSummary(undefined)).toBe("");
  });

  it("ignora conceptos sin nombre o sin monto", () => {
    expect(investmentSummary([{ concept: "", amount: 100, frequency: "unico", dueDate: "2026-07-15" }])).toBe("");
    expect(investmentSummary([{ concept: "X", amount: 0, frequency: "unico", dueDate: "2026-07-15" }])).toBe("");
  });
});

describe("buildProposalDecisionNotification", () => {
  it("aceptada con conceptos: monto único + recurrentes en el WhatsApp", () => {
    const m = buildProposalDecisionNotification(base);
    expect(m.whatsappText).toBe(
      "✅ VillaNogal aceptó la propuesta «Calculadora v2» — $5,999 MXN único + 1 concepto recurrente\n👉 pixeltec.mx/crm",
    );
    expect(m.emailSubject).toBe("✅ Propuesta aceptada: Calculadora v2 — VillaNogal");
    expect(m.inApp.type).toBe("success");
    expect(m.inApp.title).toBe("Propuesta aceptada");
    expect(m.inApp.body).toBe("VillaNogal aceptó «Calculadora v2».");
  });

  it("rechazada: ❌, type warning y sin montos", () => {
    const m = buildProposalDecisionNotification({ ...base, action: "rechazada" });
    expect(m.whatsappText).toBe("❌ VillaNogal rechazó la propuesta «Calculadora v2»\n👉 pixeltec.mx/crm");
    expect(m.emailSubject).toBe("❌ Propuesta rechazada: Calculadora v2 — VillaNogal");
    expect(m.inApp.type).toBe("warning");
    expect(m.inApp.title).toBe("Propuesta rechazada");
  });

  it("sin conceptos: omite el monto", () => {
    const m = buildProposalDecisionNotification({ ...base, billingItemDrafts: undefined });
    expect(m.whatsappText).toBe("✅ VillaNogal aceptó la propuesta «Calculadora v2»\n👉 pixeltec.mx/crm");
  });

  it("solo recurrentes: pluraliza y no muestra monto único", () => {
    const m = buildProposalDecisionNotification({
      ...base,
      billingItemDrafts: [
        { concept: "Dominio", amount: 1999, frequency: "anual" as const, dueDate: "2026-07-15" },
        { concept: "Mantenimiento", amount: 500, frequency: "trimestral" as const, dueDate: "2026-07-15" },
      ],
    });
    expect(m.whatsappText).toContain("— 2 conceptos recurrentes");
    expect(m.whatsappText).not.toContain("$");
  });

  it("cliente sin nombre: usa 'Un cliente'", () => {
    const m = buildProposalDecisionNotification({ ...base, clientName: "  " });
    expect(m.whatsappText).toContain("Un cliente aceptó");
  });
});
