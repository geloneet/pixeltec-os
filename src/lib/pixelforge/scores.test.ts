import { describe, expect, it } from "vitest";
import { computeScoreTotal } from "./scores";

describe("computeScoreTotal", () => {
  it("promedia los 4 criterios directos + (100 - riesgoGenericidadIA)", () => {
    expect(
      computeScoreTotal({
        originalidadConceptual: 80,
        independenciaDeReferencias: 80,
        especificidadDelMotif: 80,
        utilidadDelSignature: 80,
        riesgoGenericidadIA: 20,
      })
    ).toBe(80);
  });

  it("invierte riesgoGenericidadIA (100 = pésimo) antes de promediar", () => {
    // Mismos 4 directos, pero riesgo alto castiga el total.
    const base = {
      originalidadConceptual: 90,
      independenciaDeReferencias: 90,
      especificidadDelMotif: 90,
      utilidadDelSignature: 90,
    };
    expect(computeScoreTotal({ ...base, riesgoGenericidadIA: 0 })).toBe(92);
    expect(computeScoreTotal({ ...base, riesgoGenericidadIA: 100 })).toBe(72);
  });

  it("redondea hacia abajo cuando la fracción es < 0.5 (resto de división / 5 en {1,2})", () => {
    // suma = 402 -> 80.4 -> 80
    expect(
      computeScoreTotal({
        originalidadConceptual: 81,
        independenciaDeReferencias: 81,
        especificidadDelMotif: 80,
        utilidadDelSignature: 80,
        riesgoGenericidadIA: 20, // invertido: 80
      })
    ).toBe(80);
  });

  it("redondea hacia arriba cuando la fracción es >= 0.5 (resto de división / 5 en {3,4})", () => {
    // suma = 403 -> 80.6 -> 81
    expect(
      computeScoreTotal({
        originalidadConceptual: 82,
        independenciaDeReferencias: 81,
        especificidadDelMotif: 80,
        utilidadDelSignature: 80,
        riesgoGenericidadIA: 20, // invertido: 80
      })
    ).toBe(81);
  });

  it("extremo: los 5 criterios en su mejor valor posible da 100", () => {
    expect(
      computeScoreTotal({
        originalidadConceptual: 100,
        independenciaDeReferencias: 100,
        especificidadDelMotif: 100,
        utilidadDelSignature: 100,
        riesgoGenericidadIA: 0,
      })
    ).toBe(100);
  });

  it("extremo: los 5 criterios en su peor valor posible da 0", () => {
    expect(
      computeScoreTotal({
        originalidadConceptual: 0,
        independenciaDeReferencias: 0,
        especificidadDelMotif: 0,
        utilidadDelSignature: 0,
        riesgoGenericidadIA: 100,
      })
    ).toBe(0);
  });

  it("extremo: valores alternados mitad arriba mitad abajo", () => {
    expect(
      computeScoreTotal({
        originalidadConceptual: 100,
        independenciaDeReferencias: 0,
        especificidadDelMotif: 100,
        utilidadDelSignature: 0,
        riesgoGenericidadIA: 100, // invertido: 0
      })
    ).toBe(40);
  });
});
