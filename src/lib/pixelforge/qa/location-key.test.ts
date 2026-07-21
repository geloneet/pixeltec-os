import { describe, expect, it } from "vitest";
import { buildLocationKey } from "./location-key";

describe("buildLocationKey", () => {
  it("serializa los 4 segmentos en orden fijo cuando todo está presente, priorizando slot sobre selectorHash", () => {
    expect(
      buildLocationKey("QA-ST-002", { nodeId: "n1-hero", viewport: "mobile", slot: "titulo", selectorHash: "abc123" })
    ).toBe("QA-ST-002|n1-hero|mobile|titulo");
  });

  it("usa selectorHash cuando no hay slot", () => {
    expect(buildLocationKey("QA-VI-001", { nodeId: "n1-hero", viewport: "desktop", selectorHash: "abc123" })).toBe(
      "QA-VI-001|n1-hero|desktop|abc123"
    );
  });

  it("campos faltantes se serializan como '-' literal, nunca vacío ni undefined", () => {
    expect(buildLocationKey("QA-ST-001", { nodeId: "n1-hero" })).toBe("QA-ST-001|n1-hero|-|-");
    expect(buildLocationKey("QA-ST-001", {})).toBe("QA-ST-001|-|-|-");
  });

  it("sin location (undefined/null) produce el hallazgo de alcance global '-|-|-'", () => {
    expect(buildLocationKey("QA-ST-001")).toBe("QA-ST-001|-|-|-");
    expect(buildLocationKey("QA-ST-001", null)).toBe("QA-ST-001|-|-|-");
  });

  it("es estable: misma entrada produce siempre la misma clave", () => {
    const location = { nodeId: "n4-stats", viewport: "mobile", slot: "stats" };
    const first = buildLocationKey("QA-MO-004", location);
    const second = buildLocationKey("QA-MO-004", { ...location });
    expect(first).toBe(second);
  });

  it("distingue checkCode aunque la ubicación sea idéntica", () => {
    const location = { nodeId: "n1-hero", slot: "titulo" };
    expect(buildLocationKey("QA-VI-008", location)).not.toBe(buildLocationKey("QA-DI-005", location));
  });

  it("cadena vacía en un campo se trata como ausente ('-')", () => {
    expect(buildLocationKey("QA-ST-001", { nodeId: "", slot: "" })).toBe("QA-ST-001|-|-|-");
  });
});
