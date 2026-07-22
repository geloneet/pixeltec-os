// src/lib/pixelforge/review/stage.test.ts
import { describe, expect, it } from "vitest";
import type { QaGateState } from "@/lib/pixelforge/qa/gate-state";
import { computeReviewStage, isReleaseReady, type ReviewLike } from "./stage";

function gate(open: boolean, reason: QaGateState["reason"]): QaGateState {
  return { open, reason, latestClosedRun: null, currentVersionRun: null, obsolete: false };
}

function review(overrides: Partial<ReviewLike> & Pick<ReviewLike, "status">): ReviewLike {
  return { id: "rev-1", pageVersionId: "v2", ...overrides };
}

const OPEN_GATE = gate(true, null);
const FAIL_GATE = gate(false, "fail");
const NO_QA_GATE = gate(false, "no_qa");
const PENDING_GATE = gate(false, "pending_decision");
const REJECTED_GATE = gate(false, "rejected");
const STALE_GATE = gate(false, "stale");

describe("computeReviewStage", () => {
  it("sin ninguna page_version vigente: draft", () => {
    expect(computeReviewStage(NO_QA_GATE, null, null)).toBe("draft");
  });

  it("sin review relevante + gate no_qa: awaiting_qa", () => {
    expect(computeReviewStage(NO_QA_GATE, null, "v2")).toBe("awaiting_qa");
  });

  it("sin review relevante + gate pending_decision: awaiting_qa", () => {
    expect(computeReviewStage(PENDING_GATE, null, "v2")).toBe("awaiting_qa");
  });

  it("sin review relevante + gate rejected: awaiting_qa", () => {
    expect(computeReviewStage(REJECTED_GATE, null, "v2")).toBe("awaiting_qa");
  });

  it("sin review relevante + gate stale: awaiting_qa", () => {
    expect(computeReviewStage(STALE_GATE, null, "v2")).toBe("awaiting_qa");
  });

  it("sin review relevante + gate fail: qa_failed", () => {
    expect(computeReviewStage(FAIL_GATE, null, "v2")).toBe("qa_failed");
  });

  it("sin review relevante + gate abierto: ready_for_review", () => {
    expect(computeReviewStage(OPEN_GATE, null, "v2")).toBe("ready_for_review");
  });

  it("review in_review manda sin importar el gate", () => {
    const r = review({ status: "in_review" });
    expect(computeReviewStage(FAIL_GATE, r, "v2")).toBe("in_review");
    expect(computeReviewStage(OPEN_GATE, r, "v2")).toBe("in_review");
  });

  it("review changes_requested sobre la vigente: changes_requested", () => {
    const r = review({ status: "changes_requested", pageVersionId: "v2" });
    expect(computeReviewStage(OPEN_GATE, r, "v2")).toBe("changes_requested");
  });

  it("review approved sobre la vigente: approved", () => {
    const r = review({ status: "approved", pageVersionId: "v2" });
    expect(computeReviewStage(OPEN_GATE, r, "v2")).toBe("approved");
  });

  it("review approved de una versión vieja: NO manda approved, cae al gate", () => {
    const r = review({ status: "approved", pageVersionId: "v1" });
    expect(computeReviewStage(FAIL_GATE, r, "v2")).toBe("qa_failed");
    expect(computeReviewStage(OPEN_GATE, r, "v2")).toBe("ready_for_review");
  });

  it("review changes_requested de una versión vieja: cae al gate", () => {
    const r = review({ status: "changes_requested", pageVersionId: "v1" });
    expect(computeReviewStage(NO_QA_GATE, r, "v2")).toBe("awaiting_qa");
  });

  it("review cancelled sobre la vigente: cae al gate (el ciclo sigue)", () => {
    const r = review({ status: "cancelled", pageVersionId: "v2" });
    expect(computeReviewStage(OPEN_GATE, r, "v2")).toBe("ready_for_review");
    expect(computeReviewStage(NO_QA_GATE, r, "v2")).toBe("awaiting_qa");
  });

  it("review superseded sobre la vigente: cae al gate", () => {
    const r = review({ status: "superseded", pageVersionId: "v2" });
    expect(computeReviewStage(FAIL_GATE, r, "v2")).toBe("qa_failed");
  });
});

describe("isReleaseReady", () => {
  it("true si la review approved está anclada a la vigente", () => {
    const r = review({ status: "approved", pageVersionId: "v2" });
    expect(isReleaseReady(r, "v2")).toBe(true);
  });

  it("false si la review approved es de una versión vieja", () => {
    const r = review({ status: "approved", pageVersionId: "v1" });
    expect(isReleaseReady(r, "v2")).toBe(false);
  });

  it("false si la review no está approved", () => {
    const r = review({ status: "changes_requested", pageVersionId: "v2" });
    expect(isReleaseReady(r, "v2")).toBe(false);
  });

  it("false si no hay review", () => {
    expect(isReleaseReady(null, "v2")).toBe(false);
  });

  it("false si no hay vigente", () => {
    const r = review({ status: "approved", pageVersionId: "v2" });
    expect(isReleaseReady(r, null)).toBe(false);
  });
});
