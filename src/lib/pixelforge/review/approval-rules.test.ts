// src/lib/pixelforge/review/approval-rules.test.ts
import { describe, expect, it } from "vitest";
import {
  requiredRiskFindings,
  validateAcceptedRisks,
  type AcceptedRiskEntry,
  type FindingLike,
} from "./approval-rules";

const RUN_ID = "run-1";

function finding(overrides: Partial<FindingLike> & Pick<FindingLike, "id">): FindingLike {
  return { checkCode: "CHK-1", severity: "minor", blocking: false, ...overrides };
}

function entry(overrides: Partial<AcceptedRiskEntry> & Pick<AcceptedRiskEntry, "findingId">): AcceptedRiskEntry {
  return {
    qaRunId: RUN_ID,
    checkCode: "CHK-1",
    severity: "major",
    rationale: "Riesgo aceptado por el negocio.",
    acceptedById: "user-1",
    acceptedByName: "Miguel",
    acceptedAt: "2026-07-22T00:00:00.000Z",
    ...overrides,
  };
}

describe("requiredRiskFindings", () => {
  it("pass: no requiere ningún riesgo", () => {
    const findings = [finding({ id: "f1", severity: "major" })];
    expect(requiredRiskFindings("pass", findings)).toEqual([]);
  });

  it("fail: no requiere ningún riesgo (la aprobación ya está bloqueada)", () => {
    const findings = [finding({ id: "f1", severity: "major" })];
    expect(requiredRiskFindings("fail", findings)).toEqual([]);
  });

  it("pass_with_warnings: exige los findings de severity major", () => {
    const major = finding({ id: "f1", severity: "major" });
    const minor = finding({ id: "f2", severity: "minor" });
    const info = finding({ id: "f3", severity: "info" });
    expect(requiredRiskFindings("pass_with_warnings", [major, minor, info])).toEqual([major]);
  });
});

describe("validateAcceptedRisks", () => {
  it("verdict fail: siempre inválido, incluso sin findings ni entries", () => {
    const result = validateAcceptedRisks({
      verdict: "fail",
      anchoredQaRunId: RUN_ID,
      findings: [],
      entries: [],
    });
    expect(result.ok).toBe(false);
  });

  it("verdict pass con entries vacías: válido", () => {
    const result = validateAcceptedRisks({
      verdict: "pass",
      anchoredQaRunId: RUN_ID,
      findings: [],
      entries: [],
    });
    expect(result).toEqual({ ok: true });
  });

  it("verdict pass con entries no vacías pero válidas: también válido", () => {
    const findings = [finding({ id: "f1", severity: "minor" })];
    const result = validateAcceptedRisks({
      verdict: "pass",
      anchoredQaRunId: RUN_ID,
      findings,
      entries: [entry({ findingId: "f1", severity: "minor" })],
    });
    expect(result).toEqual({ ok: true });
  });

  it("pass_with_warnings con el major cubierto: válido", () => {
    const findings = [finding({ id: "f1", severity: "major" })];
    const result = validateAcceptedRisks({
      verdict: "pass_with_warnings",
      anchoredQaRunId: RUN_ID,
      findings,
      entries: [entry({ findingId: "f1" })],
    });
    expect(result).toEqual({ ok: true });
  });

  it("entry referencia un finding que no existe en el run anclado: inválido", () => {
    const findings = [finding({ id: "f1", severity: "major" })];
    const result = validateAcceptedRisks({
      verdict: "pass_with_warnings",
      anchoredQaRunId: RUN_ID,
      findings,
      entries: [entry({ findingId: "f-inexistente" })],
    });
    expect(result.ok).toBe(false);
  });

  it("entry con qaRunId distinto al anclado: inválido", () => {
    const findings = [finding({ id: "f1", severity: "major" })];
    const result = validateAcceptedRisks({
      verdict: "pass_with_warnings",
      anchoredQaRunId: RUN_ID,
      findings,
      entries: [entry({ findingId: "f1", qaRunId: "otro-run" })],
    });
    expect(result.ok).toBe(false);
  });

  it("rationale con menos de 5 caracteres tras trim: inválido", () => {
    const findings = [finding({ id: "f1", severity: "major" })];
    const result = validateAcceptedRisks({
      verdict: "pass_with_warnings",
      anchoredQaRunId: RUN_ID,
      findings,
      entries: [entry({ findingId: "f1", rationale: "   ok  " })],
    });
    expect(result.ok).toBe(false);
  });

  it("entry sobre un finding blocking: inválido, jamás aceptable", () => {
    const findings = [finding({ id: "f1", severity: "minor", blocking: true })];
    const result = validateAcceptedRisks({
      verdict: "pass_with_warnings",
      anchoredQaRunId: RUN_ID,
      findings,
      entries: [entry({ findingId: "f1", severity: "minor" })],
    });
    expect(result.ok).toBe(false);
  });

  it("entry sobre un finding de severity critical: inválido", () => {
    const findings = [finding({ id: "f1", severity: "critical" })];
    const result = validateAcceptedRisks({
      verdict: "pass_with_warnings",
      anchoredQaRunId: RUN_ID,
      findings,
      entries: [entry({ findingId: "f1", severity: "critical" })],
    });
    expect(result.ok).toBe(false);
  });

  it("falta cubrir un finding major requerido: inválido", () => {
    const findings = [finding({ id: "f1", severity: "major" }), finding({ id: "f2", severity: "major" })];
    const result = validateAcceptedRisks({
      verdict: "pass_with_warnings",
      anchoredQaRunId: RUN_ID,
      findings,
      entries: [entry({ findingId: "f1" })],
    });
    expect(result.ok).toBe(false);
  });

  it("los mensajes de error son strings en español no vacíos", () => {
    const result = validateAcceptedRisks({
      verdict: "fail",
      anchoredQaRunId: RUN_ID,
      findings: [],
      entries: [],
    });
    if (result.ok) throw new Error("se esperaba ok:false");
    expect(typeof result.error).toBe("string");
    expect(result.error.length).toBeGreaterThan(0);
  });
});
