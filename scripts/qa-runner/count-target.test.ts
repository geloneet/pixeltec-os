import { describe, expect, it } from "vitest";
import { countSettledAtTarget, formatCount, parseCountTarget } from "./count-target";

describe("parseCountTarget", () => {
  it("parsea un entero simple", () => {
    expect(parseCountTarget("120")).toEqual({
      raw: "120",
      prefix: "",
      suffix: "",
      target: 120,
      decimals: 0,
      grouped: false,
    });
  });

  it("parsea prefijo/sufijo (+, %, símbolos)", () => {
    expect(parseCountTarget("120+")).toMatchObject({ prefix: "", suffix: "+", target: 120 });
    expect(parseCountTarget("98%")).toMatchObject({ prefix: "", suffix: "%", target: 98 });
    expect(parseCountTarget("$1500")).toMatchObject({ prefix: "$", suffix: "", target: 1500 });
  });

  it("parsea separador de millares y lo recuerda como grouped", () => {
    expect(parseCountTarget("1,250")).toMatchObject({ target: 1250, grouped: true, decimals: 0 });
  });

  it("parsea decimales", () => {
    expect(parseCountTarget("4.5")).toMatchObject({ target: 4.5, decimals: 1 });
  });

  it("texto sin ninguna cifra devuelve null", () => {
    expect(parseCountTarget("N/D")).toBeNull();
    expect(parseCountTarget("")).toBeNull();
  });
});

describe("formatCount", () => {
  it("respeta decimales y agrupado del parsed", () => {
    const parsed = parseCountTarget("1,250")!;
    expect(formatCount(1250, parsed)).toBe("1,250");
    expect(formatCount(625, parsed)).toBe("625");
  });

  it("respeta decimales exactos", () => {
    const parsed = parseCountTarget("4.5")!;
    expect(formatCount(4.5, parsed)).toBe("4.5");
    expect(formatCount(2, parsed)).toBe("2.0");
  });
});

describe("countSettledAtTarget", () => {
  it("true cuando el texto mostrado coincide exactamente con el valor objetivo", () => {
    expect(countSettledAtTarget("120+", "120+")).toBe(true);
    expect(countSettledAtTarget("1,250", "1,250")).toBe(true);
  });

  it("false cuando el count-up quedó congelado en un valor intermedio (bug real que este check caza)", () => {
    expect(countSettledAtTarget("45+", "120+")).toBe(false);
    expect(countSettledAtTarget("0", "120")).toBe(false);
  });

  it("texto no numérico cae a comparación de string plana", () => {
    expect(countSettledAtTarget("N/D", "N/D")).toBe(true);
    expect(countSettledAtTarget("otro", "N/D")).toBe(false);
  });

  it("tolera espacios en blanco accidentales alrededor del texto", () => {
    expect(countSettledAtTarget(" 120+ ", "120+")).toBe(true);
  });
});
