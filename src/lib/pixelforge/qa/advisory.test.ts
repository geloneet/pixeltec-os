import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/repos/pixelforge", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/repos/pixelforge")>();
  return {
    ...actual,
    getQaRunById: vi.fn(),
    getPixelforgeProjectFull: vi.fn(),
    attachQaAdvisoryRuns: vi.fn(),
    claimRun: vi.fn(),
    finishRunRecord: vi.fn(),
    updateRunProgress: vi.fn(),
  };
});

vi.mock("../ai/run", () => ({ executeOperation: vi.fn() }));
vi.mock("../ai/client", () => ({
  getPixelforgeAnthropic: vi.fn(() => ({})),
  resolvePixelForgeModel: vi.fn(() => "claude-sonnet-5"),
}));
vi.mock("./finalize", () => ({ finalizeQaRunOrchestrated: vi.fn() }));

// Mock completo de `advisory-operations` — este archivo testea la ORQUESTACIÓN
// (idempotencia, atomicidad, orden finishRun→finalize), no la lógica interna
// de cada operación (ya cubierta por `advisory-operations.test.ts`).
vi.mock("./advisory-operations", () => {
  function makeOp() {
    return {
      loadExtra: vi.fn().mockResolvedValue({ marker: "loaded" }),
      guard: vi.fn().mockReturnValue(null),
      buildRequest: vi.fn().mockReturnValue({ system: "sys", messages: [] }),
      inputSummary: vi.fn().mockReturnValue({ nodeCount: 1 }),
      resultRef: vi.fn(),
      persistResult: vi.fn().mockResolvedValue(undefined),
      domainSchema: undefined,
      promptVersion: "v1",
    };
  }
  return {
    critiqueDesignOperation: makeOp(),
    scoreOriginalityOperation: makeOp(),
    detectAiLikenessOperation: makeOp(),
    loadAdvisoryContext: vi.fn().mockResolvedValue({ marker: "loaded" }),
  };
});

import {
  getQaRunById,
  getPixelforgeProjectFull,
  attachQaAdvisoryRuns,
  claimRun,
  finishRunRecord,
  updateRunProgress,
  type PixelforgeProjectFull,
} from "@/lib/db/repos/pixelforge";
import { executeOperation } from "../ai/run";
import { finalizeQaRunOrchestrated } from "./finalize";
import {
  critiqueDesignOperation,
  scoreOriginalityOperation,
  detectAiLikenessOperation,
} from "./advisory-operations";
import { launchQaAdvisoryRuns } from "./advisory";
import type { PixelforgeQaRun } from "@/lib/db/schema";

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

function fixtureFull(): PixelforgeProjectFull {
  return {
    project: { id: "project-1", title: "Proyecto de prueba" },
    artifacts: [],
    sources: [],
    events: [],
    visualReferences: [],
    assets: [],
    directions: [],
  } as unknown as PixelforgeProjectFull;
}

beforeEach(() => {
  vi.mocked(getQaRunById).mockReset();
  vi.mocked(getPixelforgeProjectFull).mockReset();
  vi.mocked(attachQaAdvisoryRuns).mockReset();
  vi.mocked(claimRun).mockReset();
  vi.mocked(finishRunRecord).mockReset().mockResolvedValue(undefined);
  vi.mocked(updateRunProgress).mockReset().mockResolvedValue(undefined);
  vi.mocked(executeOperation).mockReset();
  vi.mocked(finalizeQaRunOrchestrated).mockReset().mockResolvedValue(undefined);
  vi.mocked(critiqueDesignOperation.guard).mockReset().mockReturnValue(null);
  vi.mocked(scoreOriginalityOperation.guard).mockReset().mockReturnValue(null);
  vi.mocked(detectAiLikenessOperation.guard).mockReset().mockReturnValue(null);
  // `buildRequest`/`persistResult`/`loadExtra`/`inputSummary` conservan su implementación por defecto
  // (fijada una sola vez al crear el mock del módulo, `makeOp()`) — solo se limpia el CONTEO de
  // llamadas entre tests, para que "not.toHaveBeenCalled()" de un test no arrastre llamadas de otro.
  for (const op of [critiqueDesignOperation, scoreOriginalityOperation, detectAiLikenessOperation]) {
    vi.mocked(op.buildRequest).mockClear();
    vi.mocked(op.persistResult).mockClear();
    vi.mocked(op.loadExtra).mockClear();
    vi.mocked(op.inputSummary).mockClear();
  }
});

describe("launchQaAdvisoryRuns — idempotencia", () => {
  it("no-op si el qa_run ya tiene CUALQUIER FK advisory seteado", async () => {
    vi.mocked(getQaRunById).mockResolvedValue(fixtureQaRun({ critiqueRunId: "run-existente" }));

    const result = await launchQaAdvisoryRuns({ qaRunId: "qa-1", projectId: "project-1" });

    expect(result).toEqual({ launched: false, reason: "already-launched" });
    expect(getPixelforgeProjectFull).not.toHaveBeenCalled();
    expect(attachQaAdvisoryRuns).not.toHaveBeenCalled();
  });

  it("no-op si el qa_run no existe", async () => {
    vi.mocked(getQaRunById).mockResolvedValue(null);

    const result = await launchQaAdvisoryRuns({ qaRunId: "qa-x", projectId: "project-1" });

    expect(result).toEqual({ launched: false, reason: "qa-run-not-found" });
  });

  it("no-op si el qa_run no tiene actor resoluble (requestedById null)", async () => {
    vi.mocked(getQaRunById).mockResolvedValue(fixtureQaRun({ requestedById: null }));

    const result = await launchQaAdvisoryRuns({ qaRunId: "qa-1", projectId: "project-1" });

    expect(result).toEqual({ launched: false, reason: "missing-actor" });
    expect(getPixelforgeProjectFull).not.toHaveBeenCalled();
  });

  it("no-op si el proyecto no se resuelve", async () => {
    vi.mocked(getQaRunById).mockResolvedValue(fixtureQaRun());
    vi.mocked(getPixelforgeProjectFull).mockResolvedValue(null);

    const result = await launchQaAdvisoryRuns({ qaRunId: "qa-1", projectId: "project-1" });

    expect(result).toEqual({ launched: false, reason: "project-not-found" });
    expect(attachQaAdvisoryRuns).not.toHaveBeenCalled();
  });
});

describe("launchQaAdvisoryRuns — atomicidad de los 3 FKs", () => {
  it("si attachQaAdvisoryRuns devuelve null (tx no ganó / ya lanzada), NO dispara ninguna ejecución", async () => {
    vi.mocked(getQaRunById).mockResolvedValue(fixtureQaRun());
    vi.mocked(getPixelforgeProjectFull).mockResolvedValue(fixtureFull());
    vi.mocked(attachQaAdvisoryRuns).mockResolvedValue(null);

    const result = await launchQaAdvisoryRuns({ qaRunId: "qa-1", projectId: "project-1" });

    expect(result).toEqual({ launched: false, reason: "already-launched" });
    expect(claimRun).not.toHaveBeenCalled();
    expect(executeOperation).not.toHaveBeenCalled();
  });

  it("si attachQaAdvisoryRuns devuelve los 3 ids, dispara las 3 ejecuciones (nunca un subconjunto)", async () => {
    vi.mocked(getQaRunById).mockResolvedValue(fixtureQaRun());
    vi.mocked(getPixelforgeProjectFull).mockResolvedValue(fixtureFull());
    vi.mocked(attachQaAdvisoryRuns).mockResolvedValue({
      critiqueRunId: "run-critique",
      originalityRunId: "run-originality",
      likenessRunId: "run-likeness",
    });
    vi.mocked(claimRun).mockResolvedValue(true);
    vi.mocked(executeOperation).mockResolvedValue({ output: {} });

    const result = await launchQaAdvisoryRuns({ qaRunId: "qa-1", projectId: "project-1" });

    expect(result).toEqual({ launched: true });

    await vi.waitFor(() => expect(executeOperation).toHaveBeenCalledTimes(3));
    expect(claimRun).toHaveBeenCalledWith("run-critique");
    expect(claimRun).toHaveBeenCalledWith("run-originality");
    expect(claimRun).toHaveBeenCalledWith("run-likeness");
  });
});

describe("launchQaAdvisoryRuns — finishRun→finalize, incluso con la operación fallida", () => {
  it("guard rechaza → cierra el ai_run failed y de todos modos intenta finalizeQaRunOrchestrated", async () => {
    vi.mocked(getQaRunById).mockResolvedValue(fixtureQaRun());
    vi.mocked(getPixelforgeProjectFull).mockResolvedValue(fixtureFull());
    vi.mocked(attachQaAdvisoryRuns).mockResolvedValue({
      critiqueRunId: "run-critique",
      originalityRunId: "run-originality",
      likenessRunId: "run-likeness",
    });
    vi.mocked(claimRun).mockResolvedValue(true);
    vi.mocked(critiqueDesignOperation.guard).mockReturnValue("No hay un QA en curso para este proyecto");

    await launchQaAdvisoryRuns({ qaRunId: "qa-1", projectId: "project-1" });

    await vi.waitFor(() =>
      expect(finishRunRecord).toHaveBeenCalledWith(
        "run-critique",
        expect.objectContaining({ status: "failed" })
      )
    );
    expect(finalizeQaRunOrchestrated).toHaveBeenCalledWith("qa-1");
    // La operación fallida por guard nunca llega a construir el request ni a llamar al modelo.
    expect(critiqueDesignOperation.buildRequest).not.toHaveBeenCalled();
    expect(executeOperation).not.toHaveBeenCalledWith(expect.objectContaining({ operation: "critique_design" }));
  });

  it("executeOperation llama finishRun(failed) vía sus callbacks → SIEMPRE dispara finalizeQaRunOrchestrated, en el orden finishRun→finalize", async () => {
    vi.mocked(getQaRunById).mockResolvedValue(fixtureQaRun());
    vi.mocked(getPixelforgeProjectFull).mockResolvedValue(fixtureFull());
    vi.mocked(attachQaAdvisoryRuns).mockResolvedValue({
      critiqueRunId: "run-critique",
      originalityRunId: "run-originality",
      likenessRunId: "run-likeness",
    });
    vi.mocked(claimRun).mockResolvedValue(true);

    const callOrder: string[] = [];
    vi.mocked(finishRunRecord).mockImplementation(async () => {
      callOrder.push("finishRunRecord");
    });
    vi.mocked(finalizeQaRunOrchestrated).mockImplementation(async () => {
      callOrder.push("finalizeQaRunOrchestrated");
    });

    // Simula que `executeOperation` (el motor real) invoca `callbacks.finishRun` con un resultado
    // fallido — mismo contrato que `ai/run.ts` en su camino de error (nunca llama `persistResult`).
    vi.mocked(executeOperation).mockImplementation(async (params) => {
      await params.callbacks.finishRun({
        status: "failed",
        failureKind: "provider_error",
        error: "El modelo rechazó la respuesta",
        durationMs: 10,
        retryCount: 0,
      });
      return { failure: "provider_error", error: "El modelo rechazó la respuesta" };
    });

    await launchQaAdvisoryRuns({ qaRunId: "qa-1", projectId: "project-1" });

    await vi.waitFor(() => expect(finalizeQaRunOrchestrated).toHaveBeenCalled());

    expect(callOrder).toContain("finishRunRecord");
    expect(callOrder).toContain("finalizeQaRunOrchestrated");
    expect(callOrder.indexOf("finishRunRecord")).toBeLessThan(callOrder.lastIndexOf("finalizeQaRunOrchestrated"));
    // `persistResult` NUNCA se llama para una operación fallida — solo `finishRun`.
    expect(critiqueDesignOperation.persistResult).not.toHaveBeenCalled();
  });
});
