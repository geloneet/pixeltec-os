import { describe, it, expect } from "vitest";
import { PREVIEW_FIXTURE_TREE, DEFAULT_PREVIEW_TOKENS } from "./preview-tree";
import { validatePageTree, type PageTreeValidation } from "@/lib/pixelforge/registry/validate-page-tree";
import { BLOCK_IDS } from "@/lib/pixelforge/registry/blocks";
import { BEHAVIOR_IDS, type MotionTrigger } from "@/lib/pixelforge/registry/behaviors";
import { CAPABILITY_IDS, SIGNATURE_CAPABILITIES } from "@/lib/pixelforge/registry/capabilities";
import { directionTokensToCssVars } from "@/components/pixelforge/render/tokens";
import type { PageTree } from "@/lib/pixelforge/schemas/compose-page-tree";

/**
 * `CAPABILITY_IDS` tiene 4 entradas certificadas (coverage-map, comparison,
 * selector, process-visualizer) — el fixture de preview solo ejercita 2
 * (coverage-map-v1, product-selector-v1), no las 4. Estas son las que de
 * verdad aparecen en `PREVIEW_FIXTURE_TREE`.
 */
const FIXTURE_CAPABILITY_IDS = ["coverage-map-v1", "product-selector-v1"] as const;

describe("PREVIEW_FIXTURE_TREE", () => {
  const result = validatePageTree(PREVIEW_FIXTURE_TREE);

  it("valida como árbol correcto (ok:true) — dogfooding del pipeline", () => {
    expect(result.ok).toBe(true);
  });

  it("no emite ningún warning — behaviorId real, registrado y validado (F6B-T3)", () => {
    if (!result.ok) throw new Error(`fixture inválido: ${result.errors.join(" | ")}`);
    expect(result.warnings).toEqual([]);
  });

  it("usa los 12 blocks + 2 capabilities del registry, uno por nodo, con orden 1..14 único", () => {
    if (!result.ok) throw new Error("fixture inválido");
    const ids = result.tree.nodes.map((n) => n.componentId).sort();
    expect(ids).toEqual([...BLOCK_IDS, ...FIXTURE_CAPABILITY_IDS].sort());
    const ordenes = result.tree.nodes.map((n) => n.orden).sort((a, b) => a - b);
    expect(ordenes).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
  });

  it("clasifica cada nodo por kind: 12 'block' y 2 'capability' (F6C-T2/D1)", () => {
    if (!result.ok) throw new Error("fixture inválido");
    const blockNodes = result.tree.nodes.filter((n) => n.kind === "block");
    const capabilityNodes = result.tree.nodes.filter((n) => n.kind === "capability");
    expect(blockNodes).toHaveLength(12);
    expect(capabilityNodes).toHaveLength(2);
    expect(capabilityNodes.map((n) => n.componentId).sort()).toEqual([...FIXTURE_CAPABILITY_IDS].sort());
    // Ambas son certificadas de verdad, no ids inventados.
    for (const id of FIXTURE_CAPABILITY_IDS) {
      expect(CAPABILITY_IDS).toContain(id);
    }
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

  describe("capability nodes (F6C-T6)", () => {
    const capabilityNodes = PREVIEW_FIXTURE_TREE.nodes.filter((n) =>
      (CAPABILITY_IDS as string[]).includes(n.componentId)
    );

    it("agrega exactamente los 2 capability nodes certificados, sin choreography", () => {
      expect(capabilityNodes).toHaveLength(2);
      for (const node of capabilityNodes) {
        expect(node.variant).toBe("default");
        expect(node.choreography).toBeUndefined();
      }
    });

    it("cada propsJson de capability parsea y valida contra el propsSchema real del registry", () => {
      for (const node of capabilityNodes) {
        const capability = SIGNATURE_CAPABILITIES.find((c) => c.id === node.componentId);
        if (!capability) throw new Error(`capability no registrada: ${node.componentId}`);
        const parsed: unknown = JSON.parse(node.propsJson);
        const propsResult = capability.propsSchema.safeParse(parsed);
        expect(propsResult.success).toBe(true);
      }
    });

    it("coverage-map-v1 trae zonas de Puerto Vallarta/Bahía de Banderas con códigos postales y buscador habilitado", () => {
      const node = capabilityNodes.find((n) => n.componentId === "coverage-map-v1");
      if (!node) throw new Error("nodo coverage-map-v1 no encontrado en el fixture");
      const props = JSON.parse(node.propsJson) as {
        zonas: Array<{ nombre: string; codigosPostales?: string[] }>;
        buscadorPorCP?: boolean;
        mensajeFueraDeCobertura?: string;
      };
      expect(props.buscadorPorCP).toBe(true);
      expect(props.mensajeFueraDeCobertura).toBeTruthy();
      const todosLosCps = props.zonas.flatMap((z) => z.codigosPostales ?? []);
      expect(todosLosCps).toEqual(expect.arrayContaining(["48300", "63732", "48280"]));
    });

    it("product-selector-v1 trae varios kits solares filtrables por consumo e instalación", () => {
      const node = capabilityNodes.find((n) => n.componentId === "product-selector-v1");
      if (!node) throw new Error("nodo product-selector-v1 no encontrado en el fixture");
      const props = JSON.parse(node.propsJson) as {
        opciones: Array<{ id: string; atributos?: Record<string, string> }>;
        filtros?: string[];
      };
      expect(props.opciones.length).toBeGreaterThanOrEqual(4);
      expect(props.filtros).toEqual(expect.arrayContaining(["consumo", "instalacion"]));
    });
  });

  describe("mandato #9 — el árbol sin capability nodes sigue validando ok:true", () => {
    // `orden` solo exige unicidad en validatePageTree (no consecutividad), así
    // que basta con filtrar los capability nodes sin renumerar el resto.
    const blocksOnlyTree: PageTree = {
      notas: PREVIEW_FIXTURE_TREE.notas,
      nodes: PREVIEW_FIXTURE_TREE.nodes.filter(
        (n) => !(CAPABILITY_IDS as string[]).includes(n.componentId)
      ),
    };
    const blocksOnlyResult: PageTreeValidation = validatePageTree(blocksOnlyTree);

    it("sigue teniendo los 12 blocks y ningún capability node", () => {
      expect(blocksOnlyTree.nodes).toHaveLength(12);
      const ids = blocksOnlyTree.nodes.map((n) => n.componentId).sort();
      expect(ids).toEqual([...BLOCK_IDS].sort());
    });

    it("valida ok:true (la landing funciona sin capability, mandato de Miguel)", () => {
      if (!blocksOnlyResult.ok) {
        throw new Error(`árbol blocks-only inválido: ${blocksOnlyResult.errors.join(" | ")}`);
      }
      expect(blocksOnlyResult.ok).toBe(true);
      expect(blocksOnlyResult.tree.nodes.every((n) => n.kind === "block")).toBe(true);
    });
  });
});
