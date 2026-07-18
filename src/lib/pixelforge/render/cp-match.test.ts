/**
 * Tests del matcher puro de códigos postales (F6C-T4). Entorno node por defecto
 * (sin React ni jsdom): es lógica de negocio pura y determinista. Espejo del
 * criterio de `coverage-map-v1` sobre el buscador de CP (match exacto de 5
 * dígitos o por prefijo con menos de 5, normalizando a dígitos).
 */
import { describe, expect, it } from "vitest";
import { matchZonaByCp } from "./cp-match";

const zonas = [
  { nombre: "Puerto Vallarta Centro", codigosPostales: ["48300", "48310"] },
  { nombre: "Bahía de Banderas", codigosPostales: ["633"] }, // prefijo <5 dígitos
  { nombre: "Sin cobertura declarada" }, // sin codigosPostales → nunca matchea
];

describe("matchZonaByCp", () => {
  it("hace match exacto con un CP de 5 dígitos", () => {
    const r = matchZonaByCp("48300", zonas);
    expect(r.status).toBe("match");
    expect(r.status === "match" && r.zona.nombre).toBe("Puerto Vallarta Centro");
  });

  it("hace match por prefijo cuando el item tiene menos de 5 dígitos", () => {
    const r = matchZonaByCp("63300", zonas);
    expect(r.status).toBe("match");
    expect(r.status === "match" && r.zona.nombre).toBe("Bahía de Banderas");
  });

  it("normaliza la entrada a solo dígitos ('48 300' → '48300')", () => {
    const r = matchZonaByCp("48 300", zonas);
    expect(r.status).toBe("match");
    expect(r.status === "match" && r.zona.nombre).toBe("Puerto Vallarta Centro");
    // guiones y otros símbolos también se descartan
    expect(matchZonaByCp("48-310", zonas).status).toBe("match");
  });

  it("devuelve 'miss' cuando ninguna zona contiene el CP", () => {
    expect(matchZonaByCp("99999", zonas).status).toBe("miss");
  });

  it("devuelve 'invalid' con entrada vacía o con menos de 5 dígitos", () => {
    expect(matchZonaByCp("", zonas).status).toBe("invalid");
    expect(matchZonaByCp("483", zonas).status).toBe("invalid");
    expect(matchZonaByCp("abc", zonas).status).toBe("invalid");
    expect(matchZonaByCp("  ", zonas).status).toBe("invalid");
  });

  it("devuelve 'invalid' (NUNCA 'miss') con más de 5 dígitos — un typo de un carácter no debe leerse como fuera de cobertura", () => {
    // "483001" es "48300" (SÍ cubierto) con un dígito de más por error de tecleo.
    expect(matchZonaByCp("483001", zonas).status).toBe("invalid");
    expect(matchZonaByCp("999999", zonas).status).toBe("invalid");
  });

  it("ignora zonas sin codigosPostales sin lanzar", () => {
    expect(() => matchZonaByCp("48300", zonas)).not.toThrow();
    // una lista de puras zonas sin CPs siempre da miss para entrada válida
    const r = matchZonaByCp("48300", [{ nombre: "A" }, { nombre: "B" }]);
    expect(r.status).toBe("miss");
  });

  it("es determinista: gana la PRIMERA zona en orden de array ante empate", () => {
    const dupZonas = [
      { nombre: "Primera", codigosPostales: ["48300"] },
      { nombre: "Segunda", codigosPostales: ["48300"] },
    ];
    const r = matchZonaByCp("48300", dupZonas);
    expect(r.status === "match" && r.zona.nombre).toBe("Primera");
  });

  it("no lanza con zonas vacías", () => {
    expect(matchZonaByCp("48300", []).status).toBe("miss");
    // @ts-expect-error defensa en profundidad ante props degeneradas
    expect(() => matchZonaByCp("48300", null)).not.toThrow();
  });
});
