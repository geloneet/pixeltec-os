import { describe, it, expect } from "vitest";
import { PREVIEW_FIXTURE_TREE, DEFAULT_PREVIEW_TOKENS } from "./preview-tree";
import { validatePageTree } from "@/lib/pixelforge/registry/validate-page-tree";
import { BLOCK_IDS } from "@/lib/pixelforge/registry/blocks";
import { BEHAVIOR_IDS, type MotionTrigger } from "@/lib/pixelforge/registry/behaviors";
import { directionTokensToCssVars } from "@/components/pixelforge/render/tokens";

describe("PREVIEW_FIXTURE_TREE", () => {
  const result = validatePageTree(PREVIEW_FIXTURE_TREE);

  it("valida como árbol correcto (ok:true) — dogfooding del pipeline", () => {
    expect(result.ok).toBe(true);
  });

  it("no emite ningún warning — behaviorId real, registrado y validado (F6B-T3)", () => {
    if (!result.ok) throw new Error(`fixture inválido: ${result.errors.join(" | ")}`);
    expect(result.warnings).toEqual([]);
  });

  it("usa los 12 blocks del registry, uno por nodo, con orden 1..12 único", () => {
    if (!result.ok) throw new Error("fixture inválido");
    const ids = result.tree.nodes.map((n) => n.componentId).sort();
    expect(ids).toEqual([...BLOCK_IDS].sort());
    const ordenes = result.tree.nodes.map((n) => n.orden).sort((a, b) => a - b);
    expect(ordenes).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("incluye al menos una variante NO-default", () => {
    const variants = PREVIEW_FIXTURE_TREE.nodes.map((n) => `${n.componentId}:${n.variant}`);
    // hero-split default = media-right; el fixture usa media-left
    expect(variants).toContain("hero-split:media-left");
  });

  it("tiene exactamente 3 nodos cinematográficos (intensity 3) — el máximo permitido, ejercitado a propósito", () => {
    const cinematic = PREVIEW_FIXTURE_TREE.nodes.filter((n) =>
      n.choreography?.sequences.some((s) => s.intensity === 3)
    );
    expect(cinematic.map((n) => n.nodeId).sort()).toEqual(["n1-hero", "n11-cta", "n5-narrative"]);
  });

  it("todo behaviorId usado en el fixture está registrado en BEHAVIOR_IDS", () => {
    const allSequences = PREVIEW_FIXTURE_TREE.nodes.flatMap((n) => n.choreography?.sequences ?? []);
    expect(allSequences.length).toBeGreaterThan(0);
    for (const sequence of allSequences) {
      expect(BEHAVIOR_IDS).toContain(sequence.behaviorId);
    }
  });

  it("ejercita los 4 triggers y al menos 4 behaviors distintos — variedad para el gate visual", () => {
    const allSequences = PREVIEW_FIXTURE_TREE.nodes.flatMap((n) => n.choreography?.sequences ?? []);
    const triggers = new Set(allSequences.map((s) => s.trigger as MotionTrigger));
    const behaviors = new Set(allSequences.map((s) => s.behaviorId));

    const expectedTriggers: MotionTrigger[] = ["load", "in-view", "interaction", "scroll-progress"];
    for (const trigger of expectedTriggers) {
      expect(triggers.has(trigger)).toBe(true);
    }
    expect(behaviors.size).toBeGreaterThanOrEqual(4);
  });

  it("DEFAULT_PREVIEW_TOKENS se traduce a CSS vars sin lanzar", () => {
    const vars = directionTokensToCssVars(DEFAULT_PREVIEW_TOKENS);
    expect(vars["--pf-bg"]).toBe("#ffffff");
    expect(vars["--pf-primary"]).toBe("#0ea5e9");
  });
});
