import { describe, expect, it } from "vitest";
import { buildQaScreenshotKey } from "./screenshot-key";

describe("buildQaScreenshotKey", () => {
  it("calca el patrón pixelforge/<ownerId>/<projectId>/qa/<qaRunId>/<nombre>.png", () => {
    expect(buildQaScreenshotKey("owner-1", "proj-1", "run-1", "desktop-fullpage")).toBe(
      "pixelforge/owner-1/proj-1/qa/run-1/desktop-fullpage.png"
    );
  });

  it("sanea caracteres inseguros en el nombre (espacios, slashes, puntos de path traversal)", () => {
    expect(buildQaScreenshotKey("o", "p", "r", "vi-004 crop/../etc")).toBe(
      "pixelforge/o/p/qa/r/vi-004-crop----etc.png"
    );
  });

  it("dos nombres distintos producen keys distintas (sin colisión)", () => {
    const a = buildQaScreenshotKey("o", "p", "r", "mobile-fullpage");
    const b = buildQaScreenshotKey("o", "p", "r", "tablet-fullpage");
    expect(a).not.toBe(b);
  });
});
