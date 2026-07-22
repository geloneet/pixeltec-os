import { describe, expect, it } from "vitest";
import { severityForAxeImpact } from "./axe-severity";

describe("severityForAxeImpact", () => {
  it("mapea las 4 categorías reales de axe-core igual que el catálogo", () => {
    expect(severityForAxeImpact("critical")).toBe("major");
    expect(severityForAxeImpact("serious")).toBe("major");
    expect(severityForAxeImpact("moderate")).toBe("minor");
    expect(severityForAxeImpact("minor")).toBe("info");
  });

  it("impact ausente (null/undefined) degrada a info, nunca lanza", () => {
    expect(severityForAxeImpact(null)).toBe("info");
    expect(severityForAxeImpact(undefined)).toBe("info");
  });

  it("un impact desconocido (no debería pasar en axe-core 4.x) degrada a info en vez de lanzar", () => {
    expect(severityForAxeImpact("unheard-of")).toBe("info");
  });
});
