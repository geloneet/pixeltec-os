import { describe, expect, it, vi } from "vitest";

// `route.ts` importa `@/lib/auth/config` (next-auth) — bajo Vitest (Node ESM
// puro, sin el resolutor de módulos de Next) el propio `next-auth` rompe al
// intentar importar "next/server" (ver `route.test.ts` en `api/vps/backup`
// para el mismo mock). Solo necesitamos `createRunSchema`, que no depende de
// auth — mockeamos para poder importar el módulo sin arrastrar next-auth.
vi.mock("@/lib/auth/config", () => ({ auth: vi.fn() }));

import { createRunSchema } from "./route";

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const REFERENCE_ID = "22222222-2222-2222-2222-222222222222";

describe("createRunSchema", () => {
  it("rechaza analyze_reference sin referenceId", () => {
    const result = createRunSchema.safeParse({ projectId: PROJECT_ID, operation: "analyze_reference" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join(".") === "referenceId")).toBe(true);
    }
  });

  it("acepta analyze_reference con referenceId", () => {
    const result = createRunSchema.safeParse({
      projectId: PROJECT_ID,
      operation: "analyze_reference",
      referenceId: REFERENCE_ID,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.referenceId).toBe(REFERENCE_ID);
    }
  });

  it("rechaza analyze_reference con referenceId mal formado (no uuid)", () => {
    const result = createRunSchema.safeParse({
      projectId: PROJECT_ID,
      operation: "analyze_reference",
      referenceId: "no-es-un-uuid",
    });

    expect(result.success).toBe(false);
  });

  it("acepta synthesize_visual_dna sin referenceId (operación por-proyecto)", () => {
    const result = createRunSchema.safeParse({ projectId: PROJECT_ID, operation: "synthesize_visual_dna" });

    expect(result.success).toBe(true);
  });

  it("acepta analyze_context/generate_strategy sin referenceId (comportamiento previo, sin regresión)", () => {
    expect(createRunSchema.safeParse({ projectId: PROJECT_ID, operation: "analyze_context" }).success).toBe(true);
    expect(createRunSchema.safeParse({ projectId: PROJECT_ID, operation: "generate_strategy" }).success).toBe(true);
  });

  it("ignora un referenceId de sobra en una operación por-proyecto (no rompe, pero tampoco lo necesita)", () => {
    const result = createRunSchema.safeParse({
      projectId: PROJECT_ID,
      operation: "generate_strategy",
      referenceId: REFERENCE_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rechaza una operación no habilitada en esta fase", () => {
    const result = createRunSchema.safeParse({ projectId: PROJECT_ID, operation: "compose_page_tree" });

    expect(result.success).toBe(false);
  });

  it("rechaza projectId inválido", () => {
    const result = createRunSchema.safeParse({ projectId: "no-es-un-uuid", operation: "analyze_context" });

    expect(result.success).toBe(false);
  });
});
