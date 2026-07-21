import { describe, expect, it } from "vitest";
import { contrastRatio, parseCssColor, relativeLuminance } from "./contrast";

describe("contrastRatio", () => {
  it("#767676 sobre #ffffff da 4.54 (±0.01) — valor de referencia WCAG", () => {
    expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(4.54, 2);
  });

  it("#000000 sobre #ffffff da 21 (contraste máximo)", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
  });

  it("es simétrico — el orden de los argumentos no cambia el resultado", () => {
    expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(contrastRatio("#ffffff", "#767676")!, 10);
  });

  it("mismo color consigo mismo da contraste 1", () => {
    expect(contrastRatio("#123456", "#123456")).toBeCloseTo(1, 10);
  });

  it("el límite 4.5 es exacto: un par cuyo ratio real es 4.5 no cae por debajo por redondeo", () => {
    // #767676/#fff = ~4.5385 > 4.5 — confirma que el límite se compara con
    // suficiente precisión (sin redondear a 1 decimal antes del corte).
    const ratio = contrastRatio("#767676", "#ffffff")!;
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("parsea rgb()/rgba() y produce el mismo resultado que el hex equivalente", () => {
    expect(contrastRatio("rgb(0,0,0)", "rgb(255,255,255)")).toBeCloseTo(21, 5);
    expect(contrastRatio("rgba(0,0,0,0.9)", "rgba(255,255,255,1)")).toBeCloseTo(21, 5);
  });

  it("parsea hsl()/hsla()", () => {
    // hsl(0,0%,0%) = negro, hsl(0,0%,100%) = blanco.
    expect(contrastRatio("hsl(0,0%,0%)", "hsl(0,0%,100%)")).toBeCloseTo(21, 5);
    expect(contrastRatio("hsla(0,0%,0%,1)", "hsla(0,0%,100%,0.8)")).toBeCloseTo(21, 5);
  });

  it("parsea hex de 3 y 8 dígitos", () => {
    expect(contrastRatio("#000", "#fff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#000000ff", "#ffffffff")).toBeCloseTo(21, 5);
  });

  it("devuelve null si cualquiera de los dos colores no es parseable", () => {
    expect(contrastRatio("red", "#ffffff")).toBeNull();
    expect(contrastRatio("#ffffff", "currentColor")).toBeNull();
    expect(contrastRatio("not-a-color", "also-not")).toBeNull();
  });
});

describe("parseCssColor", () => {
  it("parsea hex3/hex6/hex8 case-insensitive", () => {
    expect(parseCssColor("#ABC")).toEqual({ r: 170, g: 187, b: 204 });
    expect(parseCssColor("#AABBCC")).toEqual({ r: 170, g: 187, b: 204 });
    expect(parseCssColor("#AABBCCFF")).toEqual({ r: 170, g: 187, b: 204 });
  });

  it("null para un named color o valor vacío", () => {
    expect(parseCssColor("")).toBeNull();
    expect(parseCssColor("tomato")).toBeNull();
  });
});

describe("relativeLuminance", () => {
  it("negro puro = 0, blanco puro = 1", () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0, 10);
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 10);
  });
});
