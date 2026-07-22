// src/lib/pixelforge/review/target-station.test.ts
import { describe, expect, it } from "vitest";
import { resolveChangeTarget, type ChangeKind } from "./target-station";

describe("resolveChangeTarget", () => {
  it("contenido + contexto: reabre context_brief en la estación contexto", () => {
    expect(resolveChangeTarget("contenido", "contexto")).toEqual({
      station: "contexto",
      mechanism: "reopen_artifact",
      artifactKind: "context_brief",
    });
  });

  it("contenido + estrategia: reabre landing_dna en la estación estrategia", () => {
    expect(resolveChangeTarget("contenido", "estrategia")).toEqual({
      station: "estrategia",
      mechanism: "reopen_artifact",
      artifactKind: "landing_dna",
    });
  });

  it("contenido + blueprint: reabre narrative_blueprint en la estación blueprint", () => {
    expect(resolveChangeTarget("contenido", "blueprint")).toEqual({
      station: "blueprint",
      mechanism: "reopen_artifact",
      artifactKind: "narrative_blueprint",
    });
  });

  it("contenido sin contentTarget: lanza con mensaje claro", () => {
    expect(() => resolveChangeTarget("contenido")).toThrow(/contentTarget/i);
  });

  it("direccion_visual: reabre direction_decision en la estación direcciones", () => {
    expect(resolveChangeTarget("direccion_visual")).toEqual({
      station: "direcciones",
      mechanism: "reopen_artifact",
      artifactKind: "direction_decision",
    });
  });

  it("estructura: reabre narrative_blueprint en la estación blueprint", () => {
    expect(resolveChangeTarget("estructura")).toEqual({
      station: "blueprint",
      mechanism: "reopen_artifact",
      artifactKind: "narrative_blueprint",
    });
  });

  it("composicion: regresa la estación producción, sin artifact", () => {
    expect(resolveChangeTarget("composicion")).toEqual({
      station: "produccion",
      mechanism: "regress_station",
      artifactKind: null,
    });
  });

  it("defecto_tecnico: regresa la estación producción, sin artifact", () => {
    expect(resolveChangeTarget("defecto_tecnico")).toEqual({
      station: "produccion",
      mechanism: "regress_station",
      artifactKind: null,
    });
  });

  it("defecto_registry: bloqueo técnico, sin estación ni artifact", () => {
    expect(resolveChangeTarget("defecto_registry")).toEqual({
      station: null,
      mechanism: "technical_block",
      artifactKind: null,
    });
  });

  it("un ChangeKind inválido (fuera del mapa cerrado) lanza", () => {
    expect(() => resolveChangeTarget("no_existe" as ChangeKind)).toThrow();
  });
});
