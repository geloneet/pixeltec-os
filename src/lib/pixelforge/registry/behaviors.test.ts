import { describe, expect, it } from "vitest";
import {
  BEHAVIOR_IDS,
  CERTIFIED_BEHAVIORS,
  getBehaviorDefinition,
  getBehaviorsForPrompt,
  isRegisteredBehaviorId,
  type BehaviorRecipe,
  type MotionBehaviorDefinition,
} from "./behaviors";
import { PIXELFORGE_BLOCKS } from "./blocks";

/**
 * Triggers válidos según el enum `trigger` de `motionSequenceSchema`
 * (`src/lib/pixelforge/schemas/compose-page-tree.ts:14`). Este archivo vive
 * fuera de `schemas/` (igual que `blocks.ts`) y no importa zod/v4 en runtime,
 * así que el set se declara aquí en paralelo — si el enum del schema cambia,
 * esta lista y `MotionTrigger` en `behaviors.ts` deben actualizarse juntas.
 */
const SCHEMA_TRIGGERS = ["load", "in-view", "interaction", "scroll-progress"] as const;

/** Claves cerradas que puede usar cualquier keyframe (`hidden`/`visible`) de una receta. */
const KEYFRAME_KEYS = ["opacity", "x", "y", "scale", "clipPath"];

describe("CERTIFIED_BEHAVIORS", () => {
  it("tiene exactamente 8 behaviors v1", () => {
    expect(CERTIFIED_BEHAVIORS).toHaveLength(8);
  });

  it("tiene ids únicos en kebab-case", () => {
    const ids = CERTIFIED_BEHAVIORS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z]+(-[a-z]+)*$/);
    }
  });

  it('incluye "fade-rise" (reutiliza el nombre del placeholder del fixture F6A)', () => {
    expect(BEHAVIOR_IDS).toContain("fade-rise");
  });

  it("cada allowedTrigger está dentro del enum trigger de compose-page-tree.ts", () => {
    for (const behavior of CERTIFIED_BEHAVIORS) {
      expect(behavior.allowedTriggers.length).toBeGreaterThan(0);
      for (const trigger of behavior.allowedTriggers) {
        expect(SCHEMA_TRIGGERS).toContain(trigger);
      }
    }
  });

  it("cada behavior declara name/description/aiHint no vacíos (español)", () => {
    for (const behavior of CERTIFIED_BEHAVIORS) {
      expect(behavior.name.length).toBeGreaterThan(0);
      expect(behavior.description.length).toBeGreaterThan(0);
      expect(behavior.aiHint.length).toBeGreaterThan(0);
    }
  });

  it("cada behavior cubre al menos un motionIntent", () => {
    for (const behavior of CERTIFIED_BEHAVIORS) {
      expect(behavior.coversIntents.length).toBeGreaterThan(0);
    }
  });

  it("las recetas 'tween' y 'scroll-steps' solo usan claves del set cerrado {opacity,x,y,scale,clipPath} en hidden/visible", () => {
    for (const behavior of CERTIFIED_BEHAVIORS) {
      const recipe: BehaviorRecipe = behavior.recipe;
      if (recipe.kind === "tween" || recipe.kind === "scroll-steps") {
        for (const key of Object.keys(recipe.hidden)) {
          expect(KEYFRAME_KEYS).toContain(key);
        }
        for (const key of Object.keys(recipe.visible)) {
          expect(KEYFRAME_KEYS).toContain(key);
        }
      }
    }
  });

  it("la receta 'pulse' trae scaleAmplitude numérico y 'count-up' no trae props extra", () => {
    const pulse = CERTIFIED_BEHAVIORS.find((b) => b.recipe.kind === "pulse");
    expect(pulse).toBeDefined();
    if (pulse && pulse.recipe.kind === "pulse") {
      expect(typeof pulse.recipe.scaleAmplitude).toBe("number");
    }

    const countUp = CERTIFIED_BEHAVIORS.find((b) => b.recipe.kind === "count-up");
    expect(countUp).toBeDefined();
    if (countUp) {
      expect(Object.keys(countUp.recipe)).toEqual(["kind"]);
    }
  });

  it("cinematicOnly ⇒ coversIntents interseca los motionIntents de algún block con allowsCinematic:true", () => {
    const cinematicBlockIntents = new Set(
      PIXELFORGE_BLOCKS.filter((block) => block.allowsCinematic).flatMap((block) => block.motionIntents)
    );

    for (const behavior of CERTIFIED_BEHAVIORS) {
      if (behavior.cinematicOnly) {
        const intersects = behavior.coversIntents.some((intent) => cinematicBlockIntents.has(intent));
        expect(intersects).toBe(true);
      }
    }
  });

  it("paridad de intents: cada motionIntent declarado en PIXELFORGE_BLOCKS (blocks.ts real) está cubierto por ≥1 behavior", () => {
    const allBlockIntents = new Set(PIXELFORGE_BLOCKS.flatMap((block) => block.motionIntents));
    const coveredIntents = new Set(CERTIFIED_BEHAVIORS.flatMap((behavior) => behavior.coversIntents));

    for (const intent of allBlockIntents) {
      expect(coveredIntents.has(intent)).toBe(true);
    }
  });
});

describe("BEHAVIOR_IDS / isRegisteredBehaviorId", () => {
  it("BEHAVIOR_IDS deriva 1:1 de CERTIFIED_BEHAVIORS", () => {
    expect(BEHAVIOR_IDS).toEqual(CERTIFIED_BEHAVIORS.map((b) => b.id));
  });

  it("reconoce un id certificado", () => {
    expect(isRegisteredBehaviorId("fade-rise")).toBe(true);
  });

  it("rechaza un id inexistente", () => {
    expect(isRegisteredBehaviorId("zoom-blast")).toBe(false);
  });
});

describe("getBehaviorDefinition", () => {
  it("devuelve la definición completa de un behaviorId registrado", () => {
    const def = getBehaviorDefinition("fade-rise");
    expect(def.id).toBe("fade-rise");
    expect(def.recipe.kind).toBe("tween");
  });

  it("revienta con mensaje claro si el id no está registrado", () => {
    expect(() => getBehaviorDefinition("zoom-blast" as never)).toThrow(/no registrado/);
  });
});

describe("getBehaviorsForPrompt", () => {
  it("devuelve texto en español con el id y las intents de cada behavior", () => {
    const text = getBehaviorsForPrompt();
    for (const behavior of CERTIFIED_BEHAVIORS) {
      expect(text).toContain(behavior.id);
    }
    expect(text.length).toBeGreaterThan(0);
  });
});

describe("tipos exportados", () => {
  it("MotionBehaviorDefinition/BehaviorRecipe son usables como tipos (smoke de compilación)", () => {
    const sample: MotionBehaviorDefinition = CERTIFIED_BEHAVIORS[0];
    expect(sample.id.length).toBeGreaterThan(0);
  });
});
