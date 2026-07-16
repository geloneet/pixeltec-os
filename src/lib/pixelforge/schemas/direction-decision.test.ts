import { describe, expect, it } from "vitest";
import { directionDecisionSchema } from "./direction-decision";

const validUuid = "550e8400-e29b-41d4-a716-446655440000";
const otherUuid = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

function baseDecision(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    chosenDirectionId: validUuid,
    rationale: "Es la que mejor conecta con la audiencia local sin verse genérica.",
    acceptedRisks: ["Puede requerir ajustar la tipografía en móvil."],
    combinedFromDirectionIds: [],
    ...overrides,
  };
}

describe("directionDecisionSchema", () => {
  it("acepta una decisión válida", () => {
    const result = directionDecisionSchema.safeParse(baseDecision());
    expect(result.success).toBe(true);
  });

  it("acepta combinedFromDirectionIds con otros uuids", () => {
    const result = directionDecisionSchema.safeParse(baseDecision({ combinedFromDirectionIds: [otherUuid] }));
    expect(result.success).toBe(true);
  });

  it("rechaza chosenDirectionId que no es uuid", () => {
    const result = directionDecisionSchema.safeParse(baseDecision({ chosenDirectionId: "no-es-uuid" }));
    expect(result.success).toBe(false);
  });

  it("rechaza rationale demasiado corto (< 10 caracteres)", () => {
    const result = directionDecisionSchema.safeParse(baseDecision({ rationale: "porque sí" }));
    expect(result.success).toBe(false);
  });

  it("rechaza combinedFromDirectionIds con un valor que no es uuid", () => {
    const result = directionDecisionSchema.safeParse(baseDecision({ combinedFromDirectionIds: ["no-es-uuid"] }));
    expect(result.success).toBe(false);
  });

  it("acepta acceptedRisks vacío", () => {
    const result = directionDecisionSchema.safeParse(baseDecision({ acceptedRisks: [] }));
    expect(result.success).toBe(true);
  });
});
