/**
 * Tests de la lógica PURA del repo de PixelForge — sin DB (no existe infra
 * de tests de DB en el repo; la transaccional se cubre en el smoke de fase).
 * Importar `./pixelforge` acá es seguro: el cliente de `postgres` que crea
 * `@/lib/db` es lazy (no conecta al importar, solo al ejecutar una query).
 */
import { describe, expect, it } from "vitest";
import {
  assertCombinedFromDirectionIdsValid,
  assertDirectionDecisionStillCurrent,
  computeNextPageVersion,
  hasAdvisoryRunsAttached,
  isQaGateVersionStale,
  isStaleQaRun,
  QA_BROWSER_CLAIM_TIMEOUT_MS,
  QA_BROWSER_PENDING_TIMEOUT_MS,
  QA_QUEUED_TIMEOUT_MS,
  QA_RUNNING_TIMEOUT_MS,
} from "./pixelforge";

describe("assertCombinedFromDirectionIdsValid", () => {
  const chosenId = "chosen-1";
  const projectDirectionIds = ["chosen-1", "other-2", "other-3"];

  it("no lanza si combinedFromDirectionIds está vacío", () => {
    expect(() =>
      assertCombinedFromDirectionIdsValid(chosenId, [], projectDirectionIds)
    ).not.toThrow();
  });

  it("no lanza si todos los ids son otras direcciones del mismo proyecto", () => {
    expect(() =>
      assertCombinedFromDirectionIdsValid(
        chosenId,
        ["other-2", "other-3"],
        projectDirectionIds
      )
    ).not.toThrow();
  });

  it("lanza si combinedFromDirectionIds incluye la propia dirección elegida", () => {
    expect(() =>
      assertCombinedFromDirectionIdsValid(
        chosenId,
        ["other-2", chosenId],
        projectDirectionIds
      )
    ).toThrow(/no puede incluir la propia dirección elegida/);
  });

  it("lanza si combinedFromDirectionIds incluye un id que no pertenece al proyecto (IDOR)", () => {
    expect(() =>
      assertCombinedFromDirectionIdsValid(
        chosenId,
        ["other-2", "direccion-de-otro-proyecto"],
        projectDirectionIds
      )
    ).toThrow(/no pertenece a este proyecto: direccion-de-otro-proyecto/);
  });
});

describe("assertDirectionDecisionStillCurrent", () => {
  it("no lanza si el chosenDirectionId del draft coincide con el del proyecto", () => {
    expect(() =>
      assertDirectionDecisionStillCurrent("direction-1", "direction-1")
    ).not.toThrow();
  });

  it("lanza si el proyecto ya no tiene ninguna dirección elegida (regeneración limpió chosenDirectionId)", () => {
    expect(() =>
      assertDirectionDecisionStillCurrent("direction-1", null)
    ).toThrow(/La elección quedó obsoleta/);
  });

  it("lanza si el chosenDirectionId del proyecto apunta a otra dirección (se eligió otra en paralelo)", () => {
    expect(() =>
      assertDirectionDecisionStillCurrent("direction-1", "direction-2")
    ).toThrow(/La elección quedó obsoleta/);
  });
});

describe("computeNextPageVersion", () => {
  it("devuelve 1 si el proyecto todavía no tiene ninguna versión (undefined)", () => {
    expect(computeNextPageVersion(undefined)).toBe(1);
  });

  it("devuelve version+1 dado el máximo actual", () => {
    expect(computeNextPageVersion({ version: 1 })).toBe(2);
    expect(computeNextPageVersion({ version: 7 })).toBe(8);
  });
});

describe("isStaleQaRun", () => {
  const NOW = new Date("2026-07-21T12:00:00.000Z");

  function makeRun(overrides: Partial<Parameters<typeof isStaleQaRun>[0]>) {
    return {
      status: "running" as const,
      browserStatus: "pending" as const,
      createdAt: NOW,
      browserClaimedAt: null,
      updatedAt: NOW,
      ...overrides,
    };
  }

  it("null si un run queued está fresco", () => {
    const run = makeRun({
      status: "queued",
      createdAt: new Date(NOW.getTime() - (QA_QUEUED_TIMEOUT_MS - 1000)),
    });
    expect(isStaleQaRun(run, NOW)).toBeNull();
  });

  it("queued_timeout si un run queued lleva más de 10 min sin reclamarse", () => {
    const run = makeRun({
      status: "queued",
      createdAt: new Date(NOW.getTime() - (QA_QUEUED_TIMEOUT_MS + 1000)),
    });
    expect(isStaleQaRun(run, NOW)).toBe("queued_timeout");
  });

  it("null si el navegador está running pero dentro del umbral de claim", () => {
    const run = makeRun({
      status: "running",
      browserStatus: "running",
      browserClaimedAt: new Date(NOW.getTime() - (QA_BROWSER_CLAIM_TIMEOUT_MS - 1000)),
    });
    expect(isStaleQaRun(run, NOW)).toBeNull();
  });

  it("browser_claim_timeout si el navegador quedó reclamado hace más de 10 min", () => {
    const run = makeRun({
      status: "running",
      browserStatus: "running",
      browserClaimedAt: new Date(NOW.getTime() - (QA_BROWSER_CLAIM_TIMEOUT_MS + 1000)),
    });
    expect(isStaleQaRun(run, NOW)).toBe("browser_claim_timeout");
  });

  it("null si el navegador está pending pero dentro del umbral (updatedAt reciente)", () => {
    const run = makeRun({
      browserStatus: "pending",
      updatedAt: new Date(NOW.getTime() - (QA_BROWSER_PENDING_TIMEOUT_MS - 1000)),
    });
    expect(isStaleQaRun(run, NOW)).toBeNull();
  });

  it("browser_pending_timeout si ningún runner reclamó el job en más de 10 min (updatedAt viejo)", () => {
    const run = makeRun({
      browserStatus: "pending",
      updatedAt: new Date(NOW.getTime() - (QA_BROWSER_PENDING_TIMEOUT_MS + 1000)),
    });
    expect(isStaleQaRun(run, NOW)).toBe("browser_pending_timeout");
  });

  it("running_timeout si el run entero lleva más de 20 min corriendo", () => {
    const run = makeRun({
      status: "running",
      browserStatus: "succeeded",
      createdAt: new Date(NOW.getTime() - (QA_RUNNING_TIMEOUT_MS + 1000)),
    });
    expect(isStaleQaRun(run, NOW)).toBe("running_timeout");
  });

  it("null si un run ya está succeeded/failed (cerrado), aunque sea viejo", () => {
    const succeeded = makeRun({
      status: "succeeded",
      createdAt: new Date(NOW.getTime() - (QA_RUNNING_TIMEOUT_MS + 10_000)),
    });
    const failed = makeRun({
      status: "failed",
      createdAt: new Date(NOW.getTime() - (QA_QUEUED_TIMEOUT_MS + 10_000)),
    });
    expect(isStaleQaRun(succeeded, NOW)).toBeNull();
    expect(isStaleQaRun(failed, NOW)).toBeNull();
  });

  it("queued_timeout gana si aplica antes que browser_claim_timeout (chequeo en orden)", () => {
    // Caso defensivo: un run queued nunca debería tener browserStatus
    // 'running', pero si pasara, la condición 1 (status==='queued') se
    // evalúa primero y corta ahí.
    const run = makeRun({
      status: "queued",
      browserStatus: "running",
      createdAt: new Date(NOW.getTime() - (QA_QUEUED_TIMEOUT_MS + 1000)),
      browserClaimedAt: new Date(NOW.getTime() - (QA_BROWSER_CLAIM_TIMEOUT_MS + 1000)),
    });
    expect(isStaleQaRun(run, NOW)).toBe("queued_timeout");
  });
});

describe("hasAdvisoryRunsAttached", () => {
  // Criterio de no-op idempotente de `attachQaAdvisoryRuns` (review PF-F8 T5):
  // si CUALQUIERA de los 3 FKs advisory ya está seteado, la corrida advisory
  // ya fue lanzada (por esta invocación o por otra que ganó una carrera
  // concurrente) — no hay que insertar los 3 `ai_runs` de nuevo.

  it("false si los 3 FKs advisory están en null (todavía no se lanzó nada)", () => {
    expect(
      hasAdvisoryRunsAttached({
        critiqueRunId: null,
        originalityRunId: null,
        likenessRunId: null,
      })
    ).toBe(false);
  });

  it("true si solo critiqueRunId está seteado", () => {
    expect(
      hasAdvisoryRunsAttached({
        critiqueRunId: "run-1",
        originalityRunId: null,
        likenessRunId: null,
      })
    ).toBe(true);
  });

  it("true si solo originalityRunId está seteado", () => {
    expect(
      hasAdvisoryRunsAttached({
        critiqueRunId: null,
        originalityRunId: "run-2",
        likenessRunId: null,
      })
    ).toBe(true);
  });

  it("true si solo likenessRunId está seteado", () => {
    expect(
      hasAdvisoryRunsAttached({
        critiqueRunId: null,
        originalityRunId: null,
        likenessRunId: "run-3",
      })
    ).toBe(true);
  });

  it("true si los 3 FKs advisory están seteados (ya lanzada por completo)", () => {
    expect(
      hasAdvisoryRunsAttached({
        critiqueRunId: "run-1",
        originalityRunId: "run-2",
        likenessRunId: "run-3",
      })
    ).toBe(true);
  });
});

describe("isQaGateVersionStale", () => {
  // Criterio real de `openQaGate` (review final PF-F8, finding 1): decide si
  // el gate debe abrirse comparando la versión que evaluó el qa_run contra
  // la vigente RELEÍDA dentro de la misma tx (bajo lock) — acá se prueba
  // solo la comparación pura, sin DB.

  it("false si la versión evaluada sigue siendo la vigente (mismo número) — abre el gate", () => {
    expect(isQaGateVersionStale(2, 2)).toBe(false);
  });

  it("true si la vigente avanzó más allá de la evaluada — NO abre el gate (versión obsoleta)", () => {
    expect(isQaGateVersionStale(2, 3)).toBe(true);
  });

  it("true incluso si la vigente 'retrocedió' respecto de la evaluada (cualquier discrepancia es stale, no solo hacia adelante)", () => {
    expect(isQaGateVersionStale(3, 2)).toBe(true);
  });

  it("false si no hay ninguna versión vigente (latestVersion null) — anómalo, se trata como no-stale (mismo criterio que buildStaleVersionFinding)", () => {
    expect(isQaGateVersionStale(1, null)).toBe(false);
  });
});
