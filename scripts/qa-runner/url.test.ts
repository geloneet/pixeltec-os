import { describe, expect, it } from "vitest";
import { buildQaPreviewUrl } from "./url";

describe("buildQaPreviewUrl", () => {
  it("ensambla origin + ruta + query pfqa", () => {
    expect(buildQaPreviewUrl("http://app:3000", "proj-1", "abc.def")).toBe(
      "http://app:3000/proyectos/pixelforge/proj-1/preview?pfqa=abc.def"
    );
  });

  it("recorta un trailing slash del appBaseUrl aunque loadQaRunnerEnv ya lo haga (defensivo)", () => {
    expect(buildQaPreviewUrl("http://app:3000/", "proj-1", "abc.def")).toBe(
      "http://app:3000/proyectos/pixelforge/proj-1/preview?pfqa=abc.def"
    );
  });

  it("codifica projectId y token", () => {
    expect(buildQaPreviewUrl("http://app:3000", "proj/1", "a.b+c")).toBe(
      "http://app:3000/proyectos/pixelforge/proj%2F1/preview?pfqa=a.b%2Bc"
    );
  });
});
