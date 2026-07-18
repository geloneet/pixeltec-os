import { describe, expect, it } from "vitest";
import {
  AMPLITUDE_INTENSITY_FACTOR,
  DELAY_CHILD_STAGGER_BASE_MS,
  DELAY_DISTANCE_BASE_MS,
  DELAY_DISTANCE_ORDER_MS,
  DELAY_INDEX_ORDER_MS,
  DELAY_SEMANTIC_BASE_MS,
  DELAY_SEMANTIC_ORDER_MS,
  DURATION_MS_BY_TOKEN,
  EASE_BEZIER,
  GLOBAL_INTENSITY_FACTOR,
  LINEAR_EASE,
  RHYTHM_FACTOR,
  resolveChoreography,
  type ChoreographyInput,
  type MotionDnaInput,
  type MotionSequenceInput,
} from "./resolve";

function seq(overrides: Partial<MotionSequenceInput> = {}): MotionSequenceInput {
  return {
    behaviorId: "fade-rise",
    targetSlot: "titulo",
    trigger: "load",
    order: 0,
    durationToken: "normal",
    delayStrategy: "none",
    intensity: 2,
    ...overrides,
  };
}

function choreography(sequences: MotionSequenceInput[]): ChoreographyInput {
  return {
    narrativePurpose: "Entrada del hero.",
    motifConnection: "Refuerza el signature motif de elevación.",
    sequences,
    reducedMotionFallback: "Aparece sin desplazamiento.",
  };
}

describe("resolveChoreography", () => {
  describe("casos static / never-throws", () => {
    it("reducedMotion:true siempre produce static, aunque la choreography sea válida", () => {
      const result = resolveChoreography(choreography([seq()]), undefined, true);
      expect(result).toEqual({ mode: "static", sequences: [] });
    });

    it("choreography undefined produce static", () => {
      const result = resolveChoreography(undefined, undefined, false);
      expect(result).toEqual({ mode: "static", sequences: [] });
    });

    it("sequences vacío produce static", () => {
      const result = resolveChoreography(choreography([]), undefined, false);
      expect(result).toEqual({ mode: "static", sequences: [] });
    });

    it("descarta en silencio un behaviorId no registrado, sin lanzar", () => {
      expect(() =>
        resolveChoreography(choreography([seq({ behaviorId: "no-existe-en-el-registry" })]), undefined, false)
      ).not.toThrow();
      const result = resolveChoreography(
        choreography([seq({ behaviorId: "no-existe-en-el-registry" })]),
        undefined,
        false
      );
      expect(result).toEqual({ mode: "static", sequences: [] });
    });

    it("si algunas secuencias son inválidas y otras válidas, conserva solo las válidas (no static)", () => {
      const result = resolveChoreography(
        choreography([seq({ behaviorId: "no-existe", order: 0 }), seq({ behaviorId: "fade-rise", order: 1 })]),
        undefined,
        false
      );
      expect(result.mode).toBe("animate");
      expect(result.sequences).toHaveLength(1);
      expect(result.sequences[0]?.behaviorId).toBe("fade-rise");
    });

    it("ritmo fuera del enum cerrado (drift de schema / jsonb corrupto) cae a moderado, SIN NaN en cascada (review final F6B, finding L2)", () => {
      const corrupt: MotionDnaInput = { ritmo: "turbo" as MotionDnaInput["ritmo"] };
      const result = resolveChoreography(
        choreography([
          seq({ behaviorId: "fade-rise", delayStrategy: "index", order: 2 }),
          seq({ behaviorId: "stagger-children", delayStrategy: "distance", order: 1 }),
        ]),
        corrupt,
        false
      );
      const moderado = resolveChoreography(
        choreography([
          seq({ behaviorId: "fade-rise", delayStrategy: "index", order: 2 }),
          seq({ behaviorId: "stagger-children", delayStrategy: "distance", order: 1 }),
        ]),
        { ritmo: "moderado" },
        false
      );
      // Mismos timings que ritmo:"moderado" explícito (factor neutro 1.0) — el
      // fallback no inventa un ritmo distinto, reutiliza el default del módulo.
      expect(result).toEqual(moderado);

      // Ninguna cifra numérica del spec es NaN (el contrato "nunca lanza" del
      // módulo incluye "nunca produce NaN").
      for (const s of result.sequences) {
        expect(Number.isNaN(s.durationMs)).toBe(false);
        expect(Number.isNaN(s.delayMs)).toBe(false);
        expect(Number.isNaN(s.childStaggerMs)).toBe(false);
        for (const kf of [s.hidden, s.visible]) {
          for (const v of Object.values(kf)) {
            if (typeof v === "number") expect(Number.isNaN(v)).toBe(false);
          }
        }
      }
    });
  });

  describe("tabla de duraciones 3x3 (durationToken x ritmo)", () => {
    const cases: Array<{ token: MotionSequenceInput["durationToken"]; ritmo: NonNullable<MotionDnaInput["ritmo"]>; expected: number }> = [
      { token: "fast", ritmo: "lento", expected: 313 },
      { token: "fast", ritmo: "moderado", expected: 250 },
      { token: "fast", ritmo: "rapido", expected: 200 },
      { token: "normal", ritmo: "lento", expected: 563 },
      { token: "normal", ritmo: "moderado", expected: 450 },
      { token: "normal", ritmo: "rapido", expected: 360 },
      { token: "slow", ritmo: "lento", expected: 875 },
      { token: "slow", ritmo: "moderado", expected: 700 },
      { token: "slow", ritmo: "rapido", expected: 560 },
    ];

    it.each(cases)("$token x $ritmo -> $expected ms", ({ token, ritmo, expected }) => {
      const result = resolveChoreography(
        choreography([seq({ durationToken: token })]),
        { ritmo },
        false
      );
      expect(result.sequences[0]?.durationMs).toBe(expected);
      expect(expected).toBe(Math.round(DURATION_MS_BY_TOKEN[token] * RHYTHM_FACTOR[ritmo]));
    });
  });

  describe("escalado de amplitud", () => {
    it("y:24 (fade-rise), intensity 3, intensidadGlobal 3 -> 24 x 1.5 x 1.15 = 41.4", () => {
      const result = resolveChoreography(
        choreography([seq({ behaviorId: "fade-rise", intensity: 3 })]),
        { intensidadGlobal: 3 },
        false
      );
      expect(result.sequences[0]?.hidden.y).toBeCloseTo(41.4, 10);
      expect(AMPLITUDE_INTENSITY_FACTOR[3] * GLOBAL_INTENSITY_FACTOR[3]).toBeCloseTo(1.725, 10);
      expect(24 * (AMPLITUDE_INTENSITY_FACTOR[3] * GLOBAL_INTENSITY_FACTOR[3])).toBeCloseTo(41.4, 10);
    });

    it("intensity 1, intensidadGlobal 1 escala 0.6 x 0.85 = 0.51", () => {
      const result = resolveChoreography(
        choreography([seq({ behaviorId: "fade-rise", intensity: 1 })]),
        { intensidadGlobal: 1 },
        false
      );
      expect(result.sequences[0]?.hidden.y).toBeCloseTo(24 * 0.6 * 0.85, 10);
    });

    it("nunca escala opacity ni clipPath", () => {
      const fadeIn = resolveChoreography(
        choreography([seq({ behaviorId: "fade-in", intensity: 3 })]),
        { intensidadGlobal: 3 },
        false
      );
      expect(fadeIn.sequences[0]?.hidden.opacity).toBe(0);
      expect(fadeIn.sequences[0]?.visible.opacity).toBe(1);

      const wipe = resolveChoreography(
        choreography([seq({ behaviorId: "wipe-reveal", intensity: 3 })]),
        { intensidadGlobal: 3 },
        false
      );
      expect(wipe.sequences[0]?.hidden.clipPath).toBe("inset(0 100% 0 0)");
      expect(wipe.sequences[0]?.visible.clipPath).toBe("inset(0)");
    });

    it("escala scale como 1 + (scale-1) x factor (media-reveal, scale 1.05)", () => {
      const result = resolveChoreography(
        choreography([seq({ behaviorId: "media-reveal", intensity: 3 })]),
        { intensidadGlobal: 3 },
        false
      );
      const factor = AMPLITUDE_INTENSITY_FACTOR[3] * GLOBAL_INTENSITY_FACTOR[3];
      expect(result.sequences[0]?.hidden.scale).toBeCloseTo(1 + (1.05 - 1) * factor, 10);
    });

    it("pulse: hidden/visible son {} y pulseScale = 1 + (scaleAmplitude-1) x factor", () => {
      const result = resolveChoreography(
        choreography([seq({ behaviorId: "pulse-accent", trigger: "interaction", intensity: 2 })]),
        { intensidadGlobal: 2 },
        false
      );
      const s = result.sequences[0];
      expect(s?.hidden).toEqual({});
      expect(s?.visible).toEqual({});
      const factor = AMPLITUDE_INTENSITY_FACTOR[2] * GLOBAL_INTENSITY_FACTOR[2];
      expect(s?.pulseScale).toBeCloseTo(1 + (1.03 - 1) * factor, 10);
    });

    it("count-up: hidden/visible son {} y no tiene pulseScale", () => {
      const result = resolveChoreography(
        choreography([seq({ behaviorId: "count-up", trigger: "in-view" })]),
        undefined,
        false
      );
      const s = result.sequences[0];
      expect(s?.hidden).toEqual({});
      expect(s?.visible).toEqual({});
      expect(s?.pulseScale).toBeUndefined();
      expect(s?.ease).toEqual(LINEAR_EASE);
    });
  });

  describe("ease resuelto a cubic-bezier", () => {
    it("ease-out -> [0.16,1,0.3,1]", () => {
      const result = resolveChoreography(choreography([seq({ behaviorId: "fade-rise" })]), undefined, false);
      expect(result.sequences[0]?.ease).toEqual(EASE_BEZIER["ease-out"]);
      expect(result.sequences[0]?.ease).toEqual([0.16, 1, 0.3, 1]);
    });

    it("ease-in-out -> [0.65,0,0.35,1]", () => {
      const result = resolveChoreography(choreography([seq({ behaviorId: "fade-in" })]), undefined, false);
      expect(result.sequences[0]?.ease).toEqual(EASE_BEZIER["ease-in-out"]);
      expect(result.sequences[0]?.ease).toEqual([0.65, 0, 0.35, 1]);
    });
  });

  describe("4 fórmulas de delay", () => {
    it("none -> siempre 0", () => {
      const result = resolveChoreography(
        choreography([seq({ delayStrategy: "none", order: 5 })]),
        { ritmo: "lento" },
        false
      );
      expect(result.sequences[0]?.delayMs).toBe(0);
    });

    it("index -> order x 90 x ritmo + 80 x ritmo (childStaggerMs)", () => {
      const result = resolveChoreography(
        choreography([seq({ delayStrategy: "index", order: 2 })]),
        { ritmo: "lento" },
        false
      );
      const expected = Math.round(2 * DELAY_INDEX_ORDER_MS * 1.25 + DELAY_CHILD_STAGGER_BASE_MS * 1.25);
      expect(result.sequences[0]?.delayMs).toBe(expected);
      expect(result.sequences[0]?.childStaggerMs).toBe(Math.round(DELAY_CHILD_STAGGER_BASE_MS * 1.25));
    });

    it("distance -> order x 120 x ritmo + 110 x ritmo", () => {
      const result = resolveChoreography(
        choreography([seq({ delayStrategy: "distance", order: 3 })]),
        { ritmo: "rapido" },
        false
      );
      const expected = Math.round(3 * DELAY_DISTANCE_ORDER_MS * 0.8 + DELAY_DISTANCE_BASE_MS * 0.8);
      expect(result.sequences[0]?.delayMs).toBe(expected);
    });

    it("semantic -> 250 x ritmo + order x 150 x ritmo", () => {
      const result = resolveChoreography(
        choreography([seq({ delayStrategy: "semantic", order: 1 })]),
        { ritmo: "moderado" },
        false
      );
      const expected = Math.round(DELAY_SEMANTIC_BASE_MS * 1.0 + 1 * DELAY_SEMANTIC_ORDER_MS * 1.0);
      expect(result.sequences[0]?.delayMs).toBe(expected);
    });

    it("durationMs/delayMs/childStaggerMs son siempre enteros", () => {
      const result = resolveChoreography(
        choreography([
          seq({ delayStrategy: "index", order: 1, durationToken: "fast" }),
          seq({ delayStrategy: "distance", order: 2, durationToken: "slow" }),
          seq({ delayStrategy: "semantic", order: 3, durationToken: "normal" }),
        ]),
        { ritmo: "lento" },
        false
      );
      for (const s of result.sequences) {
        expect(Number.isInteger(s.durationMs)).toBe(true);
        expect(Number.isInteger(s.delayMs)).toBe(true);
        expect(Number.isInteger(s.childStaggerMs)).toBe(true);
      }
    });
  });

  describe("defaults de motionDna", () => {
    it("motionDna undefined usa ritmo moderado (factor 1.0) e intensidadGlobal 2 (factor 1.0)", () => {
      const result = resolveChoreography(
        choreography([seq({ behaviorId: "fade-rise", durationToken: "normal", intensity: 2 })]),
        undefined,
        false
      );
      expect(result.sequences[0]?.durationMs).toBe(450);
      expect(result.sequences[0]?.hidden.y).toBe(24);
    });
  });

  describe("orden de salida", () => {
    it("ordena las secuencias resultantes por order, sin importar el orden de entrada", () => {
      const result = resolveChoreography(
        choreography([
          seq({ behaviorId: "fade-in", order: 2, targetSlot: "c" }),
          seq({ behaviorId: "fade-rise", order: 0, targetSlot: "a" }),
          seq({ behaviorId: "media-reveal", order: 1, targetSlot: "b" }),
        ]),
        undefined,
        false
      );
      expect(result.sequences.map((s) => s.targetSlot)).toEqual(["a", "b", "c"]);
    });
  });

  describe("staggerChildren pass-through", () => {
    it("stagger-children expone recipe.staggerChildren sin escalar", () => {
      const result = resolveChoreography(
        choreography([seq({ behaviorId: "stagger-children", trigger: "in-view" })]),
        undefined,
        false
      );
      expect(result.sequences[0]?.staggerChildren).toBe(0.08);
    });

    it("behaviors sin staggerChildren en el recipe lo dejan undefined", () => {
      const result = resolveChoreography(choreography([seq({ behaviorId: "fade-rise" })]), undefined, false);
      expect(result.sequences[0]?.staggerChildren).toBeUndefined();
    });
  });
});
