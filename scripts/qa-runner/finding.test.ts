import { describe, expect, it } from "vitest";
import { buildNavFinding } from "./finding";

describe("buildNavFinding", () => {
  it("lee category/severity/blocking/title/recommendation del catálogo, nunca los inventa", () => {
    const finding = buildNavFinding("QA-VI-001", {
      description: "El documento tiene overflow horizontal en desktop (scrollWidth 1400 > innerWidth 1280).",
      location: { viewport: "desktop" },
    });
    expect(finding.checkCode).toBe("QA-VI-001");
    expect(finding.category).toBe("visual");
    expect(finding.severity).toBe("major");
    expect(finding.blocking).toBe(false);
    expect(finding.source).toBe("nav");
    expect(finding.title).toBe("Overflow horizontal del documento");
    expect(finding.locationKey).toBe("QA-VI-001|-|desktop|-");
  });

  it("un check bloqueante por catálogo (QA-MO-001) produce blocking:true sin override", () => {
    const finding = buildNavFinding("QA-MO-001", { description: "deadlock" });
    expect(finding.blocking).toBe(true);
    expect(finding.severity).toBe("critical");
  });

  it("severityOverride se usa para QA-AX-001 (severidad real viene de axe, no del catálogo)", () => {
    const finding = buildNavFinding("QA-AX-001", {
      description: "color-contrast",
      severityOverride: "minor",
    });
    expect(finding.severity).toBe("minor");
  });

  it("blockingOverride permite que QA-TE-003 same-origin bloquee distinto del default", () => {
    const finding = buildNavFinding("QA-TE-003", {
      description: "recurso same-origin 404",
      blockingOverride: false,
    });
    expect(finding.blocking).toBe(false);
  });

  it("un código fuera del catálogo lanza en vez de persistir metadata inventada", () => {
    expect(() => buildNavFinding("QA-XX-999", { description: "x" })).toThrow(/QA-XX-999/);
  });

  it("evidence/location ausentes quedan undefined, no null forzado (insertQaFindings decide el default)", () => {
    const finding = buildNavFinding("QA-TE-001", { description: "pageerror" });
    expect(finding.evidence).toBeUndefined();
    expect(finding.location).toBeUndefined();
  });
});
