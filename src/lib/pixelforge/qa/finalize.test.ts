/**
 * Tests de `finalizeQaRunOrchestrated` (PF-F8 T4) — el repo (`getQaRunById`,
 * `finalizeQaRun`, `failQaRun`, `openQaGate`, etc.) se mockea por completo
 * (no hay infra de tests de DB en el repo, ver docstring de
 * `pixelforge.test.ts`); `computeQaScore`/`runDeterministicChecks`/
 * `buildStaleVersionFinding` SÍ corren reales (son módulos puros) para
 * verificar el wiring end-to-end del cierre.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { PixelforgeQaRun, PixelforgePageVersion } from "@/lib/db/schema";

const {
  getQaRunByIdMock,
  getAiRunStatusesMock,
  getPageVersionInternalMock,
  getLatestPageVersionNumberMock,
  getChosenDirectionForProjectMock,
  getQaFindingsForRunMock,
  insertQaFindingsMock,
  finalizeQaRunMock,
  failQaRunMock,
  openQaGateMock,
} = vi.hoisted(() => ({
  getQaRunByIdMock: vi.fn(),
  getAiRunStatusesMock: vi.fn(),
  getPageVersionInternalMock: vi.fn(),
  getLatestPageVersionNumberMock: vi.fn(),
  getChosenDirectionForProjectMock: vi.fn(),
  getQaFindingsForRunMock: vi.fn(),
  insertQaFindingsMock: vi.fn(),
  finalizeQaRunMock: vi.fn(),
  failQaRunMock: vi.fn(),
  openQaGateMock: vi.fn(),
}));

vi.mock("@/lib/db/repos/pixelforge", () => ({
  getQaRunById: getQaRunByIdMock,
  getAiRunStatuses: getAiRunStatusesMock,
  getPageVersionInternal: getPageVersionInternalMock,
  getLatestPageVersionNumber: getLatestPageVersionNumberMock,
  getChosenDirectionForProject: getChosenDirectionForProjectMock,
  getQaFindingsForRun: getQaFindingsForRunMock,
  insertQaFindings: insertQaFindingsMock,
  finalizeQaRun: finalizeQaRunMock,
  failQaRun: failQaRunMock,
  openQaGate: openQaGateMock,
}));

import { finalizeQaRunOrchestrated } from "./finalize";

const QA_RUN_ID = "11111111-1111-1111-1111-111111111111";
const PROJECT_ID = "22222222-2222-2222-2222-222222222222";
const PAGE_VERSION_ID = "33333333-3333-3333-3333-333333333333";

const VALID_TREE = {
  notas: "fixture válida",
  nodes: [
    {
      nodeId: "n1",
      componentId: "hero-split",
      variant: "media-right",
      orden: 1,
      propsJson: JSON.stringify({
        titulo: "Título corto",
        subtitulo: "Subtítulo corto",
        cta: { label: "Ir", href: "/contacto" },
        mediaAlt: "Alt de media",
        badges: ["a"],
      }),
    },
    {
      nodeId: "n2",
      componentId: "feature-grid",
      variant: "3-col",
      orden: 2,
      propsJson: JSON.stringify({
        titulo: "Features",
        features: [
          { titulo: "a", texto: "a" },
          { titulo: "b", texto: "b" },
          { titulo: "c", texto: "c" },
        ],
      }),
    },
    {
      nodeId: "n3",
      componentId: "footer-contact",
      variant: "default",
      orden: 3,
      propsJson: JSON.stringify({ empresa: "PIXELTEC.MX", links: [] }),
    },
  ],
};

function makeRun(overrides: Partial<PixelforgeQaRun> = {}): PixelforgeQaRun {
  return {
    id: QA_RUN_ID,
    projectId: PROJECT_ID,
    pageVersionId: PAGE_VERSION_ID,
    status: "running",
    progress: 35,
    currentPhase: "navegador",
    browserStatus: "succeeded",
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
    requestedById: "user-1",
    requestedByName: "Miguel",
    createdAt: new Date(),
    updatedAt: new Date(),
    finishedAt: null,
    ...overrides,
  } as PixelforgeQaRun;
}

function makePageVersion(overrides: Partial<PixelforgePageVersion> = {}): PixelforgePageVersion {
  return {
    id: PAGE_VERSION_ID,
    projectId: PROJECT_ID,
    version: 2,
    tree: VALID_TREE,
    notas: "",
    warnings: [],
    createdById: "user-1",
    createdByName: "Miguel",
    createdAt: new Date(),
    ...overrides,
  } as PixelforgePageVersion;
}

beforeEach(() => {
  // `resetAllMocks` — ver nota en `route.test.ts` de las rutas de QA:
  // `clearAllMocks` no limpia la implementación de un mock (solo su
  // historial de llamadas), así que un `mockRejectedValue`/`mockReturnValue`
  // de un test anterior se filtraría al siguiente sin esto.
  vi.resetAllMocks();
  getPageVersionInternalMock.mockResolvedValue(makePageVersion());
  getLatestPageVersionNumberMock.mockResolvedValue(2); // misma que la evaluada — no stale, salvo que el test lo pise.
  getChosenDirectionForProjectMock.mockResolvedValue(null);
  getQaFindingsForRunMock.mockResolvedValue([]);
  getAiRunStatusesMock.mockResolvedValue(new Map());
  finalizeQaRunMock.mockResolvedValue(true);
  // Default: el gate SIEMPRE abre — mismo shape que devuelve el repo real
  // desde que `openQaGate` pasó de `Promise<void>` a `Promise<OpenQaGateResult>`
  // (review final PF-F8, finding 1). Los tests que quieran la carrera
  // angosta (stale-version detectada DENTRO de la tx pese a que
  // `isStaleVersion` dio `false` acá) lo pisan explícitamente.
  openQaGateMock.mockResolvedValue({ opened: true });
});

describe("finalizeQaRunOrchestrated — no-op", () => {
  it("no hace nada si el run no existe", async () => {
    getQaRunByIdMock.mockResolvedValue(null);

    await finalizeQaRunOrchestrated(QA_RUN_ID);

    expect(finalizeQaRunMock).not.toHaveBeenCalled();
    expect(failQaRunMock).not.toHaveBeenCalled();
  });

  it("no hace nada si el run ya no está 'running' (ya cerrado)", async () => {
    getQaRunByIdMock.mockResolvedValue(makeRun({ status: "succeeded" }));

    await finalizeQaRunOrchestrated(QA_RUN_ID);

    expect(finalizeQaRunMock).not.toHaveBeenCalled();
    expect(failQaRunMock).not.toHaveBeenCalled();
  });

  it("no cierra si browser_status sigue 'pending' (fase de navegador no terminal)", async () => {
    getQaRunByIdMock.mockResolvedValue(makeRun({ browserStatus: "pending" }));

    await finalizeQaRunOrchestrated(QA_RUN_ID);

    expect(finalizeQaRunMock).not.toHaveBeenCalled();
    expect(failQaRunMock).not.toHaveBeenCalled();
  });
});

describe("finalizeQaRunOrchestrated — browser failed/timed_out", () => {
  it("browser_status='failed' → failQaRun('runner_error'), SIN veredicto", async () => {
    getQaRunByIdMock.mockResolvedValue(makeRun({ browserStatus: "failed" }));

    await finalizeQaRunOrchestrated(QA_RUN_ID);

    expect(failQaRunMock).toHaveBeenCalledWith(QA_RUN_ID, "runner_error", expect.stringContaining("failed"));
    expect(finalizeQaRunMock).not.toHaveBeenCalled();
    expect(openQaGateMock).not.toHaveBeenCalled();
  });

  it("browser_status='timed_out' → failQaRun('timeout'), SIN veredicto", async () => {
    getQaRunByIdMock.mockResolvedValue(makeRun({ browserStatus: "timed_out" }));

    await finalizeQaRunOrchestrated(QA_RUN_ID);

    expect(failQaRunMock).toHaveBeenCalledWith(QA_RUN_ID, "timeout", expect.stringContaining("timed_out"));
    expect(finalizeQaRunMock).not.toHaveBeenCalled();
  });
});

describe("finalizeQaRunOrchestrated — advisory nunca lanzada (sin T5)", () => {
  it("browser succeeded + advisory nunca lanzada (FKs null) → cierra de inmediato con veredicto 'pass'", async () => {
    getQaRunByIdMock.mockResolvedValue(makeRun({ browserStatus: "succeeded" }));
    getQaFindingsForRunMock.mockResolvedValue([]);

    await finalizeQaRunOrchestrated(QA_RUN_ID);

    expect(finalizeQaRunMock).toHaveBeenCalledTimes(1);
    const [, result] = finalizeQaRunMock.mock.calls[0]!;
    expect(result.verdict).toBe("pass");
    expect(result.summary.advisoryIncomplete).toBe(false);
    expect(openQaGateMock).toHaveBeenCalledWith(PROJECT_ID, QA_RUN_ID, { id: "user-1", name: "Miguel" });
  });

  it("veredicto 'pass_with_warnings' (un finding major) → NO abre la compuerta", async () => {
    getQaRunByIdMock.mockResolvedValue(makeRun({ browserStatus: "succeeded" }));
    getQaFindingsForRunMock.mockResolvedValue([
      {
        id: "f1",
        qaRunId: QA_RUN_ID,
        checkCode: "QA-DI-006",
        category: "diseno",
        severity: "major",
        blocking: false,
        source: "det",
        title: "t",
        description: "d",
        recommendation: "r",
        evidence: null,
        location: null,
        locationKey: "k",
        createdAt: new Date(),
      },
    ]);

    await finalizeQaRunOrchestrated(QA_RUN_ID);

    expect(finalizeQaRunMock).toHaveBeenCalledTimes(1);
    const [, result] = finalizeQaRunMock.mock.calls[0]!;
    expect(result.verdict).toBe("pass_with_warnings");
    expect(openQaGateMock).not.toHaveBeenCalled();
  });
});

describe("finalizeQaRunOrchestrated — advisory lanzada (forward-compat T5)", () => {
  it("advisory lanzada e incompleta, dentro de los 5 min → NO cierra todavía", async () => {
    getQaRunByIdMock.mockResolvedValue(
      makeRun({ browserStatus: "succeeded", critiqueRunId: "ai-1", createdAt: new Date() })
    );
    getAiRunStatusesMock.mockResolvedValue(new Map([["ai-1", "running"]]));

    await finalizeQaRunOrchestrated(QA_RUN_ID);

    expect(finalizeQaRunMock).not.toHaveBeenCalled();
    expect(failQaRunMock).not.toHaveBeenCalled();
  });

  it("advisory lanzada e incompleta, pasados los 5 min → cierra igual con advisoryIncomplete=true", async () => {
    getQaRunByIdMock.mockResolvedValue(
      makeRun({
        browserStatus: "succeeded",
        critiqueRunId: "ai-1",
        createdAt: new Date(Date.now() - 6 * 60 * 1000),
      })
    );
    getAiRunStatusesMock.mockResolvedValue(new Map([["ai-1", "running"]]));

    await finalizeQaRunOrchestrated(QA_RUN_ID);

    expect(finalizeQaRunMock).toHaveBeenCalledTimes(1);
    const [, result] = finalizeQaRunMock.mock.calls[0]!;
    expect(result.summary.advisoryIncomplete).toBe(true);
  });

  it("advisory lanzada y terminal → cierra sin esperar los 5 min, advisoryIncomplete=false", async () => {
    getQaRunByIdMock.mockResolvedValue(
      makeRun({ browserStatus: "succeeded", critiqueRunId: "ai-1", createdAt: new Date() })
    );
    getAiRunStatusesMock.mockResolvedValue(new Map([["ai-1", "succeeded"]]));

    await finalizeQaRunOrchestrated(QA_RUN_ID);

    expect(finalizeQaRunMock).toHaveBeenCalledTimes(1);
    const [, result] = finalizeQaRunMock.mock.calls[0]!;
    expect(result.summary.advisoryIncomplete).toBe(false);
  });
});

describe("finalizeQaRunOrchestrated — QA-ST-004 (versión obsoleta)", () => {
  it("inserta el finding ST-004 si la versión evaluada ya no es la vigente", async () => {
    getQaRunByIdMock.mockResolvedValue(makeRun({ browserStatus: "succeeded" }));
    getPageVersionInternalMock.mockResolvedValue(makePageVersion({ version: 2 }));
    getLatestPageVersionNumberMock.mockResolvedValue(5);

    await finalizeQaRunOrchestrated(QA_RUN_ID);

    expect(insertQaFindingsMock).toHaveBeenCalledWith(
      QA_RUN_ID,
      expect.arrayContaining([expect.objectContaining({ checkCode: "QA-ST-004" })])
    );
  });

  it("NO inserta ST-004 si la versión evaluada sigue siendo la vigente", async () => {
    getQaRunByIdMock.mockResolvedValue(makeRun({ browserStatus: "succeeded" }));
    getPageVersionInternalMock.mockResolvedValue(makePageVersion({ version: 2 }));
    getLatestPageVersionNumberMock.mockResolvedValue(2);

    await finalizeQaRunOrchestrated(QA_RUN_ID);

    expect(insertQaFindingsMock).not.toHaveBeenCalled();
  });
});

describe("finalizeQaRunOrchestrated — gate automático solo si la versión sigue vigente (review PF-F8 T4)", () => {
  it("verdict 'pass' + versión vigente → abre el gate (comportamiento previo intacto)", async () => {
    getQaRunByIdMock.mockResolvedValue(makeRun({ browserStatus: "succeeded" }));
    getPageVersionInternalMock.mockResolvedValue(makePageVersion({ version: 2 }));
    getLatestPageVersionNumberMock.mockResolvedValue(2);
    getQaFindingsForRunMock.mockResolvedValue([]);

    await finalizeQaRunOrchestrated(QA_RUN_ID);

    expect(finalizeQaRunMock).toHaveBeenCalledTimes(1);
    const [, result] = finalizeQaRunMock.mock.calls[0]!;
    expect(result.verdict).toBe("pass");
    expect(result.summary.gateSkippedStaleVersion).toBeUndefined();
    expect(openQaGateMock).toHaveBeenCalledWith(PROJECT_ID, QA_RUN_ID, { id: "user-1", name: "Miguel" });
  });

  it("verdict 'pass' + versión obsoleta → NO abre el gate, pero el run cierra igual con el veredicto intacto", async () => {
    getQaRunByIdMock.mockResolvedValue(makeRun({ browserStatus: "succeeded" }));
    getPageVersionInternalMock.mockResolvedValue(makePageVersion({ version: 3 }));
    getLatestPageVersionNumberMock.mockResolvedValue(4); // vigente avanzó mientras corría el QA
    getQaFindingsForRunMock.mockResolvedValue([]);

    await finalizeQaRunOrchestrated(QA_RUN_ID);

    expect(finalizeQaRunMock).toHaveBeenCalledTimes(1);
    const [, result] = finalizeQaRunMock.mock.calls[0]!;
    expect(result.verdict).toBe("pass"); // el veredicto/score NO cambian — solo se omite el gate.
    expect(result.summary.gateSkippedStaleVersion).toBe(true);
    expect(openQaGateMock).not.toHaveBeenCalled();
  });

  it("verdict 'pass' + versión obsoleta → el finding QA-ST-004 sigue insertándose", async () => {
    getQaRunByIdMock.mockResolvedValue(makeRun({ browserStatus: "succeeded" }));
    getPageVersionInternalMock.mockResolvedValue(makePageVersion({ version: 3 }));
    getLatestPageVersionNumberMock.mockResolvedValue(4);
    getQaFindingsForRunMock.mockResolvedValue([]);

    await finalizeQaRunOrchestrated(QA_RUN_ID);

    expect(insertQaFindingsMock).toHaveBeenCalledWith(
      QA_RUN_ID,
      expect.arrayContaining([expect.objectContaining({ checkCode: "QA-ST-004" })])
    );
    expect(openQaGateMock).not.toHaveBeenCalled();
  });
});

describe("finalizeQaRunOrchestrated — openQaGate detecta stale-version DENTRO de su tx (review final PF-F8, finding 1)", () => {
  it("gate devuelve {opened:false, reason:'stale-version'} pese a isStaleVersion=false acá → no revienta, deja rastro por consola", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    getQaRunByIdMock.mockResolvedValue(makeRun({ browserStatus: "succeeded" }));
    getPageVersionInternalMock.mockResolvedValue(makePageVersion({ version: 2 }));
    getLatestPageVersionNumberMock.mockResolvedValue(2); // acá NO parece stale...
    getQaFindingsForRunMock.mockResolvedValue([]);
    // ...pero la tx real de openQaGate, un instante después, ya ve una v3
    // (carrera con compose_page_tree) y se niega a abrir.
    openQaGateMock.mockResolvedValue({ opened: false, reason: "stale-version" });

    await expect(finalizeQaRunOrchestrated(QA_RUN_ID)).resolves.toBeUndefined();

    expect(finalizeQaRunMock).toHaveBeenCalledTimes(1);
    const [, result] = finalizeQaRunMock.mock.calls[0]!;
    expect(result.verdict).toBe("pass");
    // El summary ya se persistió con isStaleVersion=false — no se reescribe.
    expect(result.summary.gateSkippedStaleVersion).toBeUndefined();
    expect(openQaGateMock).toHaveBeenCalledWith(PROJECT_ID, QA_RUN_ID, { id: "user-1", name: "Miguel" });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("gate no abierto"), expect.any(Object));

    warnSpy.mockRestore();
  });
});

describe("finalizeQaRunOrchestrated — nunca deja el run colgado", () => {
  it("una excepción inesperada cierra el run vía failQaRun('internal') SIN persistir su message", async () => {
    // Antes afirmaba `stringContaining("DB caída")`. Ese texto se guarda en
    // `pixelforge_qa_runs.error` y el GET de `runs/[qaRunId]` devuelve la fila
    // entera al poller: era una fuga diferida, no un log interno.
    getQaRunByIdMock.mockResolvedValue(makeRun({ browserStatus: "succeeded" }));
    getPageVersionInternalMock.mockRejectedValue(
      new Error('DB caída: relation "pixelforge_qa_runs" does not exist')
    );

    await finalizeQaRunOrchestrated(QA_RUN_ID);

    expect(failQaRunMock).toHaveBeenCalledWith(QA_RUN_ID, "internal", "Error inesperado");
    const persisted = failQaRunMock.mock.calls.at(-1)?.[2] ?? "";
    expect(persisted).not.toContain("DB caída");
    expect(persisted).not.toContain("pixelforge_qa_runs");
  });
});
