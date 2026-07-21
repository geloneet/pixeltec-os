import { beforeEach, describe, expect, it, vi } from "vitest";

// `route.ts` importa `@/lib/auth/config` (next-auth) — bajo Vitest (Node ESM
// puro, sin el resolutor de módulos de Next) el propio `next-auth` rompe al
// intentar importar "next/server" (ver `route.test.ts` en `api/vps/backup`
// para el mismo mock). Solo necesitamos `createRunSchema`, que no depende de
// auth — mockeamos para poder importar el módulo sin arrastrar next-auth.
vi.mock("@/lib/auth/config", () => ({ auth: vi.fn() }));

// Mock PARCIAL (`importOriginal` conserva el resto tal cual) — el resto de
// `ENABLED_OPERATIONS` no necesita esto (sus guards son funciones puras sobre
// el fixture de `PixelforgeProjectFull`), pero `compose_page_tree.persistResult`
// (F7-T3) sí llama al repo real (`insertPageVersion`, que abre una transacción
// contra `db`) — se reemplaza solo esa función para poder testear
// `persistResult` sin una DB real, sin tener que re-declarar el resto del
// módulo (`createRun`/`claimRun`/etc., que ninguna prueba de este archivo
// ejercita).
vi.mock("@/lib/db/repos/pixelforge", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/repos/pixelforge")>();
  return { ...actual, insertPageVersion: vi.fn() };
});

// Mismo criterio: `compose_page_tree.persistResult` re-valida con `validatePageTree`
// (defensa en profundidad, D2/D4) — se mockea para testear el wiring de
// `persistResult` (llama validatePageTree, lanza si !ok, inserta si ok) sin
// tener que armar un PageTree real que pase TODAS las reglas del registry
// (ya cubiertas exhaustivamente por `validate-page-tree.test.ts`).
vi.mock("@/lib/pixelforge/registry/validate-page-tree", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/pixelforge/registry/validate-page-tree")>();
  return { ...actual, validatePageTree: vi.fn() };
});

import { createRunSchema, resolveDomainSchema, ENABLED_OPERATIONS } from "./route";
import type { PixelforgeArtifact, PixelforgeCreativeDirection, PixelforgeProject } from "@/lib/db/schema";
import type { PixelforgeProjectFull, InsertedPageVersion } from "@/lib/db/repos/pixelforge";
import { insertPageVersion } from "@/lib/db/repos/pixelforge";
import { validatePageTree } from "@/lib/pixelforge/registry/validate-page-tree";

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const REFERENCE_ID = "22222222-2222-2222-2222-222222222222";
const DIRECTION_ID = "44444444-4444-4444-4444-444444444444";

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
    const result = createRunSchema.safeParse({ projectId: PROJECT_ID, operation: "propose_change" });

    expect(result.success).toBe(false);
  });

  it("acepta compose_page_tree (F7) sin referenceId ni slot", () => {
    const result = createRunSchema.safeParse({ projectId: PROJECT_ID, operation: "compose_page_tree" });

    expect(result.success).toBe(true);
  });

  it("rechaza slot en compose_page_tree (solo aplica a generate_directions)", () => {
    const result = createRunSchema.safeParse({ projectId: PROJECT_ID, operation: "compose_page_tree", slot: 1 });

    expect(result.success).toBe(false);
  });

  it("acepta build_narrative (F6A) sin referenceId ni slot", () => {
    const result = createRunSchema.safeParse({ projectId: PROJECT_ID, operation: "build_narrative" });

    expect(result.success).toBe(true);
  });

  it("rechaza slot en build_narrative (solo aplica a generate_directions)", () => {
    const result = createRunSchema.safeParse({ projectId: PROJECT_ID, operation: "build_narrative", slot: 1 });

    expect(result.success).toBe(false);
  });

  it("rechaza projectId inválido", () => {
    const result = createRunSchema.safeParse({ projectId: "no-es-un-uuid", operation: "analyze_context" });

    expect(result.success).toBe(false);
  });

  it("acepta generate_directions sin slot (generación completa)", () => {
    const result = createRunSchema.safeParse({ projectId: PROJECT_ID, operation: "generate_directions" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.slot).toBeUndefined();
    }
  });

  it("acepta generate_directions con slot 1-3 (regeneración de un slot)", () => {
    for (const slot of [1, 2, 3]) {
      const result = createRunSchema.safeParse({ projectId: PROJECT_ID, operation: "generate_directions", slot });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.slot).toBe(slot);
      }
    }
  });

  it("rechaza slot fuera de 1-3 en generate_directions", () => {
    for (const slot of [0, 4, -1]) {
      const result = createRunSchema.safeParse({ projectId: PROJECT_ID, operation: "generate_directions", slot });
      expect(result.success).toBe(false);
    }
  });

  it("rechaza slot en una operación distinta de generate_directions", () => {
    const result = createRunSchema.safeParse({ projectId: PROJECT_ID, operation: "synthesize_visual_dna", slot: 1 });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join(".") === "slot")).toBe(true);
    }
  });
});

describe("resolveDomainSchema (resolución de OperationConfig.domainSchema: valor u función de ctx/extra)", () => {
  const ctx = { ownerId: "owner-1", slot: 2 };

  it("devuelve el valor tal cual cuando domainSchema NO es una función", () => {
    const staticSchema = { safeParse: () => ({ success: true }) } as unknown as Parameters<
      typeof resolveDomainSchema
    >[0];

    expect(resolveDomainSchema(staticSchema, ctx, undefined)).toBe(staticSchema);
  });

  it("devuelve undefined tal cual cuando domainSchema es undefined", () => {
    expect(resolveDomainSchema(undefined, ctx, undefined)).toBeUndefined();
  });

  it("invoca la función con (ctx, extra) cuando domainSchema es una función — caso generate_directions", () => {
    const extra = { some: "extra" };
    const resolved = { marker: "resolved-schema" };
    const fn = vi.fn().mockReturnValue(resolved);

    const result = resolveDomainSchema(fn, ctx, extra);

    expect(fn).toHaveBeenCalledWith(ctx, extra);
    expect(result).toBe(resolved);
  });
});

// ─── Fixtures de PixelforgeProjectFull (solo los campos que el guard de build_narrative lee: artifacts,
// directions, project.chosenDirectionId) — factory con overrides, mismo patrón que DirectionCard.test.tsx.
function fixtureProject(overrides: Partial<PixelforgeProject> = {}): PixelforgeProject {
  return {
    id: PROJECT_ID,
    ownerId: "owner-1",
    clientId: "client-1",
    clientCrmId: "crm-1",
    crmProjectId: null,
    definitionId: null,
    title: "Proyecto de prueba",
    brainDump: "brain dump de prueba",
    currentStation: "blueprint",
    status: "in_progress",
    chosenDirectionId: DIRECTION_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as PixelforgeProject;
}

function fixtureArtifact(overrides: Partial<PixelforgeArtifact> = {}): PixelforgeArtifact {
  return {
    id: "artifact-1",
    projectId: PROJECT_ID,
    kind: "direction_decision",
    status: "pending",
    currentDraft: null,
    sealedContent: null,
    sealedAt: null,
    sealedById: null,
    sealedByName: null,
    reopenCount: 0,
    lastRunId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as PixelforgeArtifact;
}

function fixtureDirection(overrides: Partial<PixelforgeCreativeDirection> = {}): PixelforgeCreativeDirection {
  return {
    id: DIRECTION_ID,
    projectId: PROJECT_ID,
    slot: 1,
    title: "Editorial urgente",
    concept: "Tipografía condensada y timers de countdown.",
    designTokens: {},
    motionDna: {},
    signatureMotif: {},
    signatureComponent: {},
    scores: {},
    scoreTotal: 70,
    status: "chosen",
    generationRunId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as PixelforgeCreativeDirection;
}

function fixtureFull(overrides: Partial<PixelforgeProjectFull> = {}): PixelforgeProjectFull {
  return {
    project: fixtureProject(),
    artifacts: [],
    sources: [],
    events: [],
    visualReferences: [],
    assets: [],
    directions: [],
    ...overrides,
  };
}

describe("ENABLED_OPERATIONS.build_narrative.guard", () => {
  const { guard } = ENABLED_OPERATIONS.build_narrative;

  it("exige la decisión de dirección sellada antes del blueprint", () => {
    const full = fixtureFull({
      artifacts: [fixtureArtifact({ kind: "direction_decision", status: "pending" })],
      directions: [fixtureDirection()],
    });

    expect(guard(full)).toBe("Sella la decisión de dirección antes del blueprint");
  });

  it("rechaza regenerar si el Blueprint ya está sellado", () => {
    const full = fixtureFull({
      artifacts: [
        fixtureArtifact({ kind: "direction_decision", status: "sealed" }),
        fixtureArtifact({ kind: "narrative_blueprint", status: "sealed" }),
      ],
      directions: [fixtureDirection()],
    });

    expect(guard(full)).toBe("El Blueprint está sellado; reábrelo para regenerar");
  });

  it("rechaza si la elección quedó obsoleta — la dirección elegida ya no tiene status chosen (fue regenerada)", () => {
    const full = fixtureFull({
      project: fixtureProject({ chosenDirectionId: DIRECTION_ID }),
      artifacts: [fixtureArtifact({ kind: "direction_decision", status: "sealed" })],
      directions: [fixtureDirection({ status: "discarded" })],
    });

    expect(guard(full)).toBe("La elección quedó obsoleta — vuelve a elegir");
  });

  it("rechaza si chosenDirectionId es null", () => {
    const full = fixtureFull({
      project: fixtureProject({ chosenDirectionId: null }),
      artifacts: [fixtureArtifact({ kind: "direction_decision", status: "sealed" })],
      directions: [fixtureDirection()],
    });

    expect(guard(full)).toBe("La elección quedó obsoleta — vuelve a elegir");
  });

  it("permite arrancar cuando la decisión está sellada, el blueprint no, y la elección sigue vigente", () => {
    const full = fixtureFull({
      artifacts: [fixtureArtifact({ kind: "direction_decision", status: "sealed" })],
      directions: [fixtureDirection({ status: "chosen" })],
    });

    expect(guard(full)).toBeNull();
  });

  it("permite arrancar cuando el Blueprint existe pero NO está sellado (regeneración normal)", () => {
    const full = fixtureFull({
      artifacts: [
        fixtureArtifact({ kind: "direction_decision", status: "sealed" }),
        fixtureArtifact({ kind: "narrative_blueprint", status: "in_progress" }),
      ],
      directions: [fixtureDirection({ status: "chosen" })],
    });

    expect(guard(full)).toBeNull();
  });
});

describe("ENABLED_OPERATIONS.compose_page_tree.guard (F7-T3)", () => {
  const { guard } = ENABLED_OPERATIONS.compose_page_tree;

  it("exige el Blueprint sellado antes de componer", () => {
    const full = fixtureFull({
      artifacts: [fixtureArtifact({ kind: "narrative_blueprint", status: "in_progress" })],
      directions: [fixtureDirection()],
    });

    expect(guard(full)).toBe("Sella el Blueprint antes de componer la landing");
  });

  it("exige el Blueprint sellado cuando el artifact ni siquiera existe todavía", () => {
    const full = fixtureFull({ artifacts: [], directions: [fixtureDirection()] });

    expect(guard(full)).toBe("Sella el Blueprint antes de componer la landing");
  });

  it("rechaza si la elección quedó obsoleta — la dirección elegida ya no tiene status chosen (fue regenerada)", () => {
    const full = fixtureFull({
      project: fixtureProject({ chosenDirectionId: DIRECTION_ID }),
      artifacts: [fixtureArtifact({ kind: "narrative_blueprint", status: "sealed" })],
      directions: [fixtureDirection({ status: "discarded" })],
    });

    expect(guard(full)).toBe("La elección quedó obsoleta — vuelve a elegir");
  });

  it("rechaza si chosenDirectionId es null", () => {
    const full = fixtureFull({
      project: fixtureProject({ chosenDirectionId: null }),
      artifacts: [fixtureArtifact({ kind: "narrative_blueprint", status: "sealed" })],
      directions: [fixtureDirection()],
    });

    expect(guard(full)).toBe("La elección quedó obsoleta — vuelve a elegir");
  });

  it("permite arrancar cuando el Blueprint está sellado y la elección sigue vigente", () => {
    const full = fixtureFull({
      artifacts: [fixtureArtifact({ kind: "narrative_blueprint", status: "sealed" })],
      directions: [fixtureDirection({ status: "chosen" })],
    });

    expect(guard(full)).toBeNull();
  });

  it("NO bloquea por versiones existentes — recomponer es una operación normal (D4); el guard nunca consulta page_versions", () => {
    // `PixelforgeProjectFull` (el fixture completo) no trae ningún campo de versiones de página —
    // este test deja explícito, junto al de arriba, que el mismo estado "listo para componer" sigue
    // devolviendo null sin importar cuántas veces se haya corrido antes.
    const full = fixtureFull({
      artifacts: [fixtureArtifact({ kind: "narrative_blueprint", status: "sealed" })],
      directions: [fixtureDirection({ status: "chosen" })],
    });

    expect(guard(full)).toBeNull();
    expect(guard(full)).toBeNull();
  });
});

describe("ENABLED_OPERATIONS.compose_page_tree.persistResult (F7-T3)", () => {
  const { persistResult } = ENABLED_OPERATIONS.compose_page_tree;
  const ctx = {
    ownerId: "owner-1",
    projectId: PROJECT_ID,
    actor: { id: "owner-1", name: "Trabajador de prueba" },
    runId: "run-1",
  };

  beforeEach(() => {
    vi.mocked(insertPageVersion).mockReset();
    vi.mocked(validatePageTree).mockReset();
  });

  it("re-valida con validatePageTree (defensa en profundidad) e inserta el output RAW cuando es válido", async () => {
    const rawOutput = {
      nodes: [{ nodeId: "n1", componentId: "footer-contact", variant: "default", orden: 1, propsJson: "{}" }],
      notas: "Composición inicial",
    };
    vi.mocked(validatePageTree).mockReturnValue({
      ok: true,
      tree: { nodes: [], notas: rawOutput.notas },
      warnings: ["aviso de fallback usado"],
    });
    const inserted: InsertedPageVersion = { id: "pv-1", version: 1 };
    vi.mocked(insertPageVersion).mockResolvedValue(inserted);

    await persistResult(rawOutput, ctx);

    expect(validatePageTree).toHaveBeenCalledWith(rawOutput);
    // `tree` debe ser el output RAW (con `propsJson` string) — byte-fiel a lo validado, NO el
    // `ValidatedPageTree` transformado que devuelve `validatePageTree` (D5 necesita poder re-validar
    // lo guardado en el preview).
    expect(insertPageVersion).toHaveBeenCalledWith(
      PROJECT_ID,
      "owner-1",
      { tree: rawOutput, notas: rawOutput.notas, warnings: ["aviso de fallback usado"] },
      ctx.actor
    );
  });

  it("lanza con los errores de validatePageTree cuando el output no valida — nunca inserta (marca la corrida failed)", async () => {
    const rawOutput = { nodes: [], notas: "" };
    vi.mocked(validatePageTree).mockReturnValue({
      ok: false,
      errors: ["el árbol debe cerrar con un nodo footer-contact", "el árbol tiene menos de 3 nodos"],
    });

    await expect(persistResult(rawOutput, ctx)).rejects.toThrow(
      "el árbol debe cerrar con un nodo footer-contact | el árbol tiene menos de 3 nodos"
    );
    expect(insertPageVersion).not.toHaveBeenCalled();
  });

  it("una segunda corrida (recomponer) vuelve a insertar sin bloquearse — cada llamada crea una versión nueva", async () => {
    const rawOutput = {
      nodes: [{ nodeId: "n1", componentId: "footer-contact", variant: "default", orden: 1, propsJson: "{}" }],
      notas: "v2",
    };
    vi.mocked(validatePageTree).mockReturnValue({
      ok: true,
      tree: { nodes: [], notas: rawOutput.notas },
      warnings: [],
    });
    vi.mocked(insertPageVersion)
      .mockResolvedValueOnce({ id: "pv-1", version: 1 })
      .mockResolvedValueOnce({ id: "pv-2", version: 2 });

    await persistResult(rawOutput, ctx);
    await persistResult(rawOutput, ctx);

    expect(insertPageVersion).toHaveBeenCalledTimes(2);
  });
});

describe("ENABLED_OPERATIONS.compose_page_tree (metadatos)", () => {
  it("resultRef es estático (el id/version real todavía no existe al momento de createRun)", () => {
    expect(ENABLED_OPERATIONS.compose_page_tree.resultRef()).toBe("page_version:project");
  });

  it("domainSchema es composePageTreeDomainSchema (valor fijo, no función — a diferencia de generate_directions)", () => {
    expect(typeof ENABLED_OPERATIONS.compose_page_tree.domainSchema).not.toBe("function");
  });
});
