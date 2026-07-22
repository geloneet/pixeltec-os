// src/lib/pixelforge/qa/gate-state.test.ts
import { describe, expect, it } from "vitest";
import { computeQaGateState, qaRailStatus, wouldRunOpenGate, type QaGateRunLike } from "./gate-state";

function run(overrides: Partial<QaGateRunLike> & Pick<QaGateRunLike, "id" | "pageVersionId">): QaGateRunLike {
  return {
    status: "succeeded",
    verdict: null,
    humanDecision: null,
    ...overrides,
  };
}

describe("wouldRunOpenGate", () => {
  it("pass abre el gate", () => {
    expect(wouldRunOpenGate({ verdict: "pass", humanDecision: null })).toBe(true);
  });

  it("pass_with_warnings + approved abre el gate", () => {
    expect(wouldRunOpenGate({ verdict: "pass_with_warnings", humanDecision: "approved" })).toBe(true);
  });

  it("pass_with_warnings sin decisión NO abre el gate", () => {
    expect(wouldRunOpenGate({ verdict: "pass_with_warnings", humanDecision: null })).toBe(false);
  });

  it("pass_with_warnings + rejected NO abre el gate", () => {
    expect(wouldRunOpenGate({ verdict: "pass_with_warnings", humanDecision: "rejected" })).toBe(false);
  });

  it("fail nunca abre el gate", () => {
    expect(wouldRunOpenGate({ verdict: "fail", humanDecision: "approved" })).toBe(false);
  });
});

describe("computeQaGateState", () => {
  it("sin ninguna page_version vigente: cerrado, sin QA", () => {
    const result = computeQaGateState([], null);
    expect(result).toEqual({
      open: false,
      reason: "no_qa",
      latestClosedRun: null,
      currentVersionRun: null,
      obsolete: false,
    });
  });

  it("sin ningún qa_run: cerrado, sin QA", () => {
    const result = computeQaGateState([], "v2");
    expect(result.open).toBe(false);
    expect(result.reason).toBe("no_qa");
    expect(result.currentVersionRun).toBeNull();
    expect(result.obsolete).toBe(false);
  });

  it("pass sobre la vigente: abierto", () => {
    const r = run({ id: "r1", pageVersionId: "v2", verdict: "pass" });
    const result = computeQaGateState([r], "v2");
    expect(result.open).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.currentVersionRun).toEqual(r);
    expect(result.obsolete).toBe(false);
  });

  it("pass_with_warnings sin decisión sobre la vigente: cerrado (pending_decision)", () => {
    const r = run({ id: "r1", pageVersionId: "v2", verdict: "pass_with_warnings" });
    const result = computeQaGateState([r], "v2");
    expect(result.open).toBe(false);
    expect(result.reason).toBe("pending_decision");
    expect(result.currentVersionRun).toEqual(r);
  });

  it("pass_with_warnings + approved sobre la vigente: abierto", () => {
    const r = run({
      id: "r1",
      pageVersionId: "v2",
      verdict: "pass_with_warnings",
      humanDecision: "approved",
    });
    const result = computeQaGateState([r], "v2");
    expect(result.open).toBe(true);
    expect(result.reason).toBeNull();
  });

  it("pass_with_warnings + rejected sobre la vigente: cerrado (rejected)", () => {
    const r = run({
      id: "r1",
      pageVersionId: "v2",
      verdict: "pass_with_warnings",
      humanDecision: "rejected",
    });
    const result = computeQaGateState([r], "v2");
    expect(result.open).toBe(false);
    expect(result.reason).toBe("rejected");
  });

  it("fail sobre la vigente: cerrado (fail)", () => {
    const r = run({ id: "r1", pageVersionId: "v2", verdict: "fail" });
    const result = computeQaGateState([r], "v2");
    expect(result.open).toBe(false);
    expect(result.reason).toBe("fail");
  });

  it("qa_run de una versión anterior con pass, vigente sin QA cerrado: cerrado + obsoleto (stale)", () => {
    const old = run({ id: "r1", pageVersionId: "v1", verdict: "pass" });
    const result = computeQaGateState([old], "v2");
    expect(result.open).toBe(false);
    expect(result.reason).toBe("stale");
    expect(result.obsolete).toBe(true);
    expect(result.currentVersionRun).toBeNull();
    expect(result.latestClosedRun).toEqual(old);
  });

  it("ignora runs queued/running/failed (sin verdict) al buscar el cerrado más reciente", () => {
    const active = run({ id: "r0", pageVersionId: "v2", status: "running", verdict: null });
    const failed = run({ id: "r1", pageVersionId: "v2", status: "failed", verdict: null });
    const passed = run({ id: "r2", pageVersionId: "v1", verdict: "pass" });
    // Orden desc por createdAt: el más nuevo primero (active, failed, passed).
    const result = computeQaGateState([active, failed, passed], "v2");
    expect(result.reason).toBe("stale");
    expect(result.latestClosedRun).toEqual(passed);
  });

  it("toma el primer match como el más reciente para la vigente si `runs` viene desc por createdAt", () => {
    const newer = run({ id: "r-newer", pageVersionId: "v2", verdict: "fail" });
    const older = run({ id: "r-older", pageVersionId: "v2", verdict: "pass" });
    const result = computeQaGateState([newer, older], "v2");
    expect(result.currentVersionRun).toEqual(newer);
    expect(result.reason).toBe("fail");
  });
});

describe("qaRailStatus", () => {
  it("sealed si el gate está abierto", () => {
    expect(
      qaRailStatus({
        open: true,
        reason: null,
        latestClosedRun: null,
        currentVersionRun: null,
        obsolete: false,
      })
    ).toBe("sealed");
  });

  it("invalidated si hay un temple viejo que habría abierto el gate y la vigente no tiene QA cerrado", () => {
    const old = run({ id: "r1", pageVersionId: "v1", verdict: "pass" });
    expect(
      qaRailStatus({
        open: false,
        reason: "stale",
        latestClosedRun: old,
        currentVersionRun: null,
        obsolete: true,
      })
    ).toBe("invalidated");
  });

  it("null (deja el default) si el temple viejo era un fail", () => {
    const old = run({ id: "r1", pageVersionId: "v1", verdict: "fail" });
    expect(
      qaRailStatus({
        open: false,
        reason: "stale",
        latestClosedRun: old,
        currentVersionRun: null,
        obsolete: true,
      })
    ).toBeNull();
  });

  it("null si no hay ningún QA en absoluto", () => {
    expect(
      qaRailStatus({
        open: false,
        reason: "no_qa",
        latestClosedRun: null,
        currentVersionRun: null,
        obsolete: false,
      })
    ).toBeNull();
  });

  it("null si el gate está cerrado por fail/pending sobre la propia vigente (no obsoleto)", () => {
    const r = run({ id: "r1", pageVersionId: "v2", verdict: "fail" });
    expect(
      qaRailStatus({
        open: false,
        reason: "fail",
        latestClosedRun: r,
        currentVersionRun: r,
        obsolete: false,
      })
    ).toBeNull();
  });
});
