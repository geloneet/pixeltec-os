import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock PARCIAL (`importOriginal` conserva el resto tal cual) — mismo criterio que
// `route.test.ts` (F7-T3): `persistResult` de las 3 operaciones llama al repo real
// (`insertQaFindings`), se reemplaza solo esa función para testear el mapeo
// rúbrica → finding sin una DB real.
vi.mock("@/lib/db/repos/pixelforge", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/repos/pixelforge")>();
  return { ...actual, insertQaFindings: vi.fn() };
});

import { insertQaFindings } from "@/lib/db/repos/pixelforge";
import type { PixelforgeProjectFull } from "@/lib/db/repos/pixelforge";
import type { PixelforgeQaRun, PixelforgePageVersion } from "@/lib/db/schema";
import {
  critiqueDesignOperation,
  scoreOriginalityOperation,
  detectAiLikenessOperation,
  type AdvisoryOperationCtx,
  type LoadedAdvisoryContext,
} from "./advisory-operations";
import type { Rubric } from "../schemas/critique-design";
import type { AiLikeness } from "../schemas/detect-ai-likeness";

const DUMMY_FULL = {} as PixelforgeProjectFull;
const CTX: AdvisoryOperationCtx = { ownerId: "owner-1", qaRunId: "qa-1" };

function fixtureQaRun(overrides: Partial<PixelforgeQaRun> = {}): PixelforgeQaRun {
  return {
    id: "qa-1",
    projectId: "project-1",
    pageVersionId: "pv-1",
    status: "running",
    progress: 35,
    currentPhase: "ia",
    browserStatus: "pending",
    browserClaimedAt: null,
    browserFinishedAt: null,
    verdict: null,
    scoreTotal: null,
    categoryScores: null,
    summary: null,
    catalogVersion: "1",
    scoringVersion: "1",
    engine: null,
    critiqueRunId: null,
    originalityRunId: null,
    likenessRunId: null,
    humanDecision: null,
    humanDecisionById: null,
    humanDecisionByName: null,
    humanDecisionAt: null,
    humanDecisionReason: null,
    failureKind: null,
    error: null,
    requestedById: "owner-1",
    requestedByName: "Trabajador de prueba",
    createdAt: new Date(),
    updatedAt: new Date(),
    finishedAt: null,
    ...overrides,
  } as PixelforgeQaRun;
}

function fixtureLoaded(overrides: Partial<PixelforgeQaRun> = {}): LoadedAdvisoryContext {
  return { qaRun: fixtureQaRun(overrides), pageVersion: {} as PixelforgePageVersion };
}

describe.each([
  ["critiqueDesignOperation", critiqueDesignOperation, "critiqueRunId" as const, "La crítica de diseño IA"],
  ["scoreOriginalityOperation", scoreOriginalityOperation, "originalityRunId" as const, "El score de originalidad IA"],
  ["detectAiLikenessOperation", detectAiLikenessOperation, "likenessRunId" as const, "La detección de semejanza IA"],
])("%s.guard", (_name, op, fkField, label) => {
  const { guard } = op;

  it("rechaza con 409 si no hay qa_run en absoluto (extra null)", () => {
    expect(guard(DUMMY_FULL, CTX, null)).toBe("No hay un QA en curso para este proyecto");
  });

  it("rechaza si el qa_run existe pero no está running", () => {
    const loaded = fixtureLoaded({ status: "succeeded" });
    expect(guard(DUMMY_FULL, CTX, loaded)).toBe("No hay un QA en curso para este proyecto");
  });

  it("acepta cuando hay un qa_run running con el FK de esta operación vacío", () => {
    const loaded = fixtureLoaded({ status: "running" });
    expect(guard(DUMMY_FULL, CTX, loaded)).toBeNull();
  });

  it("rechaza si el FK de esta operación ya está seteado (ya se lanzó para este QA)", () => {
    const loaded = fixtureLoaded({ status: "running", [fkField]: "run-existente" });
    expect(guard(DUMMY_FULL, CTX, loaded)).toBe(`${label} ya se lanzó para este QA`);
  });
});

function fixtureRubric(overrides: Partial<Rubric> = {}): Rubric {
  return {
    score: 80,
    veredicto: "Sólido en general",
    criteria: [
      { nombre: "jerarquía visual", score: 85, reasons: ["El hero domina claramente la vista inicial"], warnings: [], confidence: "alta" },
      { nombre: "coherencia con el Design DNA", score: 90, reasons: ["Usa la paleta de la dirección"], warnings: [], confidence: "alta" },
      { nombre: "variedad de componentes", score: 70, reasons: ["Combina 4 tipos de bloque distintos"], warnings: [], confidence: "media" },
    ],
    ...overrides,
  };
}

describe("critiqueDesignOperation.persistResult", () => {
  const { persistResult } = critiqueDesignOperation;

  beforeEach(() => {
    vi.mocked(insertQaFindings).mockReset();
  });

  it("rúbrica con score 45 (< 60) → severity minor", async () => {
    const rubric = fixtureRubric({ score: 45, veredicto: "Débil" });

    await persistResult(rubric, CTX);

    expect(insertQaFindings).toHaveBeenCalledWith("qa-1", [
      expect.objectContaining({
        checkCode: "QA-IA-001",
        category: "ia",
        severity: "minor",
        blocking: false,
        source: "ia",
        locationKey: "-",
      }),
    ]);
  });

  it("rúbrica con score 80 (>= 60) → severity info", async () => {
    const rubric = fixtureRubric({ score: 80 });

    await persistResult(rubric, CTX);

    expect(insertQaFindings).toHaveBeenCalledWith(
      "qa-1",
      expect.arrayContaining([expect.objectContaining({ checkCode: "QA-IA-001", severity: "info" })])
    );
  });

  it("blocking SIEMPRE false, source SIEMPRE 'ia' — regla de oro advisory", async () => {
    await persistResult(fixtureRubric({ score: 5 }), CTX); // incluso el peor score posible.

    expect(insertQaFindings).toHaveBeenCalledWith(
      "qa-1",
      expect.arrayContaining([expect.objectContaining({ blocking: false, source: "ia" })])
    );
  });

  it("lanza si falta qaRunId en ctx (defensa en profundidad)", async () => {
    await expect(persistResult(fixtureRubric(), { ownerId: "owner-1" })).rejects.toThrow(/Falta qaRunId/);
    expect(insertQaFindings).not.toHaveBeenCalled();
  });
});

describe("scoreOriginalityOperation.persistResult", () => {
  const { persistResult } = scoreOriginalityOperation;

  beforeEach(() => {
    vi.mocked(insertQaFindings).mockReset();
  });

  it("rúbrica con score 45 → severity minor, checkCode QA-IA-002", async () => {
    await persistResult(fixtureRubric({ score: 45 }), CTX);

    expect(insertQaFindings).toHaveBeenCalledWith("qa-1", [
      expect.objectContaining({ checkCode: "QA-IA-002", severity: "minor", category: "ia", locationKey: "-" }),
    ]);
  });

  it("rúbrica con score 80 → severity info", async () => {
    await persistResult(fixtureRubric({ score: 80 }), CTX);

    expect(insertQaFindings).toHaveBeenCalledWith("qa-1", [expect.objectContaining({ checkCode: "QA-IA-002", severity: "info" })]);
  });
});

describe("detectAiLikenessOperation.persistResult", () => {
  const { persistResult } = detectAiLikenessOperation;

  beforeEach(() => {
    vi.mocked(insertQaFindings).mockReset();
  });

  it("3 señales detectadas → 3 findings con locationKey estables (sig:0, sig:1, sig:2), severity SIEMPRE info", async () => {
    const likeness: AiLikeness = {
      ...fixtureRubric({ score: 30 }),
      senalesDetectadas: [
        'Frase plantilla: "en el mundo actual"',
        "Tres listas de exactamente 3 ítems con longitudes casi idénticas",
        'Adjetivo vacío sin respaldo: "innovador"',
      ],
    };

    await persistResult(likeness, CTX);

    expect(insertQaFindings).toHaveBeenCalledWith("qa-1", [
      expect.objectContaining({ checkCode: "QA-IA-003", severity: "info", blocking: false, source: "ia", locationKey: "sig:0" }),
      expect.objectContaining({ checkCode: "QA-IA-003", severity: "info", locationKey: "sig:1" }),
      expect.objectContaining({ checkCode: "QA-IA-003", severity: "info", locationKey: "sig:2" }),
    ]);
  });

  it("sin señales detectadas → no inserta ningún finding (resultado positivo)", async () => {
    const likeness: AiLikeness = { ...fixtureRubric({ score: 95 }), senalesDetectadas: [] };

    await persistResult(likeness, CTX);

    expect(insertQaFindings).not.toHaveBeenCalled();
  });
});
