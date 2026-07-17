import { describe, it, expect } from "vitest";
import { PREVIEW_FIXTURE_TREE, DEFAULT_PREVIEW_TOKENS } from "./preview-tree";
import { validatePageTree } from "@/lib/pixelforge/registry/validate-page-tree";
import { BLOCK_IDS } from "@/lib/pixelforge/registry/blocks";
import { directionTokensToCssVars } from "@/components/pixelforge/render/tokens";

describe("PREVIEW_FIXTURE_TREE", () => {
  const result = validatePageTree(PREVIEW_FIXTURE_TREE);

  it("valida como árbol correcto (ok:true) — dogfooding del pipeline", () => {
    expect(result.ok).toBe(true);
  });

  it("emite SOLO warnings de behaviorId (deferral a F6B), nunca errores", () => {
    if (!result.ok) throw new Error(`fixture inválido: ${result.errors.join(" | ")}`);
    expect(result.warnings.length).toBeGreaterThan(0);
    for (const w of result.warnings) {
      expect(w).toContain("behaviors registry llega en F6B");
    }
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

  it("tiene exactamente 2 nodos cinematográficos (intensity 3), dentro del máximo", () => {
    const cinematic = PREVIEW_FIXTURE_TREE.nodes.filter((n) =>
      n.choreography?.sequences.some((s) => s.intensity === 3)
    );
    expect(cinematic).toHaveLength(2);
  });

  it("DEFAULT_PREVIEW_TOKENS se traduce a CSS vars sin lanzar", () => {
    const vars = directionTokensToCssVars(DEFAULT_PREVIEW_TOKENS);
    expect(vars["--pf-bg"]).toBe("#ffffff");
    expect(vars["--pf-primary"]).toBe("#0ea5e9");
  });
});
