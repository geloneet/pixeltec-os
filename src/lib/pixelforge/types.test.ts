import { describe, expect, it } from "vitest";
import {
  ARTIFACT_KINDS,
  PIXELFORGE_STATION_SEQUENCE,
  STATION_ARTIFACT,
  downstreamKinds,
  isDownstream,
  isValidStation,
  nextStation,
  stationForKind,
  stationOrder,
} from "./types";
import { STATION_META } from "./station-meta";

describe("PIXELFORGE_STATION_SEQUENCE / stationOrder", () => {
  it("mantiene el orden canónico de las 8 estaciones", () => {
    expect(PIXELFORGE_STATION_SEQUENCE).toEqual([
      "contexto",
      "estrategia",
      "visual",
      "direcciones",
      "blueprint",
      "produccion",
      "qa",
      "revision",
    ]);
  });

  it("stationOrder devuelve el índice de cada estación en la secuencia", () => {
    expect(stationOrder("contexto")).toBe(0);
    expect(stationOrder("estrategia")).toBe(1);
    expect(stationOrder("revision")).toBe(7);
  });
});

describe("nextStation", () => {
  it("devuelve la siguiente estación en la secuencia", () => {
    expect(nextStation("contexto")).toBe("estrategia");
    expect(nextStation("visual")).toBe("direcciones");
    expect(nextStation("qa")).toBe("revision");
  });

  it("devuelve null si es la última estación", () => {
    expect(nextStation("revision")).toBeNull();
  });
});

describe("isDownstream", () => {
  it("true si target va después de from", () => {
    expect(isDownstream("contexto", "estrategia")).toBe(true);
    expect(isDownstream("contexto", "revision")).toBe(true);
    expect(isDownstream("blueprint", "qa")).toBe(true);
  });

  it("false si target va antes de from", () => {
    expect(isDownstream("estrategia", "contexto")).toBe(false);
    expect(isDownstream("revision", "contexto")).toBe(false);
  });

  it("false si from y target son la misma estación", () => {
    expect(isDownstream("visual", "visual")).toBe(false);
  });
});

describe("isValidStation", () => {
  it("true para estaciones válidas", () => {
    for (const s of PIXELFORGE_STATION_SEQUENCE) {
      expect(isValidStation(s)).toBe(true);
    }
  });

  it("false para valores inválidos", () => {
    expect(isValidStation("boceto")).toBe(false);
    expect(isValidStation("")).toBe(false);
    expect(isValidStation("Contexto")).toBe(false);
    expect(isValidStation("random")).toBe(false);
  });
});

describe("STATION_ARTIFACT", () => {
  it("tiene una entrada para las 8 estaciones", () => {
    expect(Object.keys(STATION_ARTIFACT)).toHaveLength(8);
    for (const s of PIXELFORGE_STATION_SEQUENCE) {
      expect(STATION_ARTIFACT).toHaveProperty(s);
    }
  });

  it("mapea las estaciones de F1 a su artifact kind", () => {
    expect(STATION_ARTIFACT.contexto).toBe("context_brief");
    expect(STATION_ARTIFACT.estrategia).toBe("landing_dna");
    expect(STATION_ARTIFACT.visual).toBe("visual_dna");
    expect(STATION_ARTIFACT.direcciones).toBe("direction_decision");
    expect(STATION_ARTIFACT.blueprint).toBe("narrative_blueprint");
  });

  it("mapea las estaciones de fases futuras a null", () => {
    expect(STATION_ARTIFACT.produccion).toBeNull();
    expect(STATION_ARTIFACT.qa).toBeNull();
    expect(STATION_ARTIFACT.revision).toBeNull();
  });
});

describe("STATION_META", () => {
  it("tiene las 8 estaciones", () => {
    expect(STATION_META).toHaveLength(8);
  });

  it("el order de cada entrada coincide con su posición en la secuencia", () => {
    for (const meta of STATION_META) {
      expect(meta.order).toBe(stationOrder(meta.id));
    }
  });

  it("los ids de STATION_META cubren exactamente PIXELFORGE_STATION_SEQUENCE", () => {
    expect(STATION_META.map((m) => m.id).sort()).toEqual(
      [...PIXELFORGE_STATION_SEQUENCE].sort()
    );
  });
});

describe("downstreamKinds", () => {
  it("devuelve los kinds posteriores en el orden canónico", () => {
    expect(downstreamKinds("context_brief")).toEqual([
      "landing_dna",
      "visual_dna",
      "direction_decision",
      "narrative_blueprint",
    ]);
    expect(downstreamKinds("landing_dna")).toEqual([
      "visual_dna",
      "direction_decision",
      "narrative_blueprint",
    ]);
    expect(downstreamKinds("visual_dna")).toEqual([
      "direction_decision",
      "narrative_blueprint",
    ]);
    expect(downstreamKinds("direction_decision")).toEqual(["narrative_blueprint"]);
  });

  it("vacío para el último kind", () => {
    expect(downstreamKinds("narrative_blueprint")).toEqual([]);
  });
});

describe("stationForKind", () => {
  it("es la inversa de STATION_ARTIFACT para cada kind", () => {
    for (const kind of ARTIFACT_KINDS) {
      expect(STATION_ARTIFACT[stationForKind(kind)]).toBe(kind);
    }
  });

  it("mapea cada kind a su estación", () => {
    expect(stationForKind("context_brief")).toBe("contexto");
    expect(stationForKind("landing_dna")).toBe("estrategia");
    expect(stationForKind("visual_dna")).toBe("visual");
    expect(stationForKind("direction_decision")).toBe("direcciones");
    expect(stationForKind("narrative_blueprint")).toBe("blueprint");
  });
});
