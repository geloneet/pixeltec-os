import { describe, expect, it } from "vitest";
import { OPERATION_SPECS, PIXELFORGE_AI_OPERATIONS } from "./index";

describe("OPERATION_SPECS (registro central de las 11 operaciones IA)", () => {
  it("registra las 11 operaciones declaradas en PIXELFORGE_AI_OPERATIONS", () => {
    expect(PIXELFORGE_AI_OPERATIONS).toHaveLength(11);
    for (const op of PIXELFORGE_AI_OPERATIONS) {
      expect(OPERATION_SPECS[op]).toBeDefined();
    }
    expect(Object.keys(OPERATION_SPECS).sort()).toEqual([...PIXELFORGE_AI_OPERATIONS].sort());
  });

  it("cada spec tiene un outputSchema Zod, promptVersion no vacío y maxTokens > 0", () => {
    for (const op of PIXELFORGE_AI_OPERATIONS) {
      const spec = OPERATION_SPECS[op];
      expect(typeof spec.outputSchema.safeParse).toBe("function");
      expect(spec.promptVersion.length).toBeGreaterThan(0);
      expect(spec.maxTokens).toBeGreaterThan(0);
    }
  });

  it("safeParse de un objeto vacío en cada schema NO revienta el runtime — solo devuelve error", () => {
    for (const op of PIXELFORGE_AI_OPERATIONS) {
      const spec = OPERATION_SPECS[op];
      expect(() => spec.outputSchema.safeParse({})).not.toThrow();
      const result = spec.outputSchema.safeParse({});
      expect(result.success).toBe(false);
    }
  });
});

function direccionFixture(slot: 1 | 2 | 3) {
  return {
    slot,
    title: `Dirección ${slot}`,
    concept: "Concepto editorial minimalista con acentos de color de marca.",
    designTokens: {
      paleta: [
        { token: "color-primario", valor: "#0F172A", uso: "Fondos oscuros y texto principal." },
        { token: "color-fondo", valor: "#FFFFFF", uso: "Fondo general de la landing." },
        { token: "color-acento", valor: "#F59E0B", uso: "CTAs y elementos destacados." },
      ],
      tipografia: { display: "Fraunces", body: "Inter", escala: "Modular 1.25, base 16px" },
      radios: "suaves",
      espaciado: "equilibrado",
    },
    motionDna: {
      personalidad: "Transmitir confianza sin ser aburrido.",
      ritmo: "moderado",
      intensidadGlobal: 2,
      firmas: ["Entradas escalonadas por distancia al cursor."],
    },
    signatureMotif: {
      nombre: "Trazo de cobertura",
      descripcion: "Una línea que dibuja el área de servicio.",
      aplicaciones: ["hero", "sección de zonas"],
    },
    signatureComponent: {
      status: "custom-development-required" as const,
      concept: "Mapa interactivo de zonas de cobertura.",
      businessValue: "Permite al visitante confirmar cobertura sin llamar.",
      requiredData: ["polígonos de zonas", "colonias atendidas"],
      estimatedComplexity: "medium" as const,
    },
    scores: {
      originalidadConceptual: 70,
      independenciaDeReferencias: 65,
      especificidadDelMotif: 65,
      utilidadDelSignature: 60,
      riesgoGenericidadIA: 30,
    },
    scoresRazones: {
      porCriterio: "Originalidad alta por el motif propio; riesgo de genericidad bajo por evitar patrones IA comunes.",
    },
    risks: ["Puede verse genérico si no se cuida la tipografía."],
  };
}

describe("generate_directions: la FORMA acepta 1 a 3 direcciones (la exactitud por modo es un refine de dominio, no de forma)", () => {
  it("acepta exactamente 3", () => {
    const { outputSchema } = OPERATION_SPECS.generate_directions;
    const result = outputSchema.safeParse({
      direcciones: [direccionFixture(1), direccionFixture(2), direccionFixture(3)],
    });
    expect(result.success).toBe(true);
  });

  it("acepta 1 (forma usada también para regenerar un solo slot)", () => {
    const { outputSchema } = OPERATION_SPECS.generate_directions;
    const result = outputSchema.safeParse({
      direcciones: [direccionFixture(1)],
    });
    expect(result.success).toBe(true);
  });

  it("rechaza 0", () => {
    const { outputSchema } = OPERATION_SPECS.generate_directions;
    const result = outputSchema.safeParse({ direcciones: [] });
    expect(result.success).toBe(false);
  });

  it("rechaza 4", () => {
    const { outputSchema } = OPERATION_SPECS.generate_directions;
    const result = outputSchema.safeParse({
      direcciones: [direccionFixture(1), direccionFixture(2), direccionFixture(3), direccionFixture(1)],
    });
    expect(result.success).toBe(false);
  });
});

function pageNodeFixture(nodeId: string, orden: number) {
  return {
    nodeId,
    componentId: "hero-split",
    variant: "default",
    orden,
    propsJson: "{}",
  };
}

describe("compose_page_tree rechaza nodeIds duplicados", () => {
  it("acepta nodeIds únicos", () => {
    const { outputSchema } = OPERATION_SPECS.compose_page_tree;
    const result = outputSchema.safeParse({
      nodes: [pageNodeFixture("n1", 1), pageNodeFixture("n2", 2), pageNodeFixture("n3", 3)],
      notas: "Árbol base de 3 secciones.",
    });
    expect(result.success).toBe(true);
  });

  it("rechaza nodeIds repetidos", () => {
    const { outputSchema } = OPERATION_SPECS.compose_page_tree;
    const result = outputSchema.safeParse({
      nodes: [pageNodeFixture("n1", 1), pageNodeFixture("n1", 2), pageNodeFixture("n3", 3)],
      notas: "Árbol con nodeId duplicado.",
    });
    expect(result.success).toBe(false);
  });
});

function actoFixture(orden: number) {
  return {
    orden,
    proposito: `Propósito del acto ${orden}`,
    mensaje: `Mensaje del acto ${orden}`,
    tension: `Tensión del acto ${orden}`,
    resolucion: `Resolución del acto ${orden}`,
  };
}

describe("build_narrative rechaza actos no consecutivos", () => {
  it("acepta actos consecutivos desde 1", () => {
    const { outputSchema } = OPERATION_SPECS.build_narrative;
    const result = outputSchema.safeParse({
      historia: "Historia de una constructora familiar que crece con cada proyecto.",
      actos: [actoFixture(1), actoFixture(2), actoFixture(3)],
      cinematicMoments: [],
      notasProduccion: [],
    });
    expect(result.success).toBe(true);
  });

  it("rechaza actos que saltan un número (1, 3, 4)", () => {
    const { outputSchema } = OPERATION_SPECS.build_narrative;
    const result = outputSchema.safeParse({
      historia: "Historia de una constructora familiar que crece con cada proyecto.",
      actos: [actoFixture(1), actoFixture(3), actoFixture(4)],
      cinematicMoments: [],
      notasProduccion: [],
    });
    expect(result.success).toBe(false);
  });
});
