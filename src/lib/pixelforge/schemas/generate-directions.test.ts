import { describe, expect, it } from "vitest";
import { buildCreativeDirectionsDomainSchema, type Direccion } from "./generate-directions";
import { CAPABILITY_IDS } from "../registry/capabilities";

function direccionFixture(slot: number, overrides: Partial<Direccion> = {}): Direccion {
  return {
    slot,
    title: `Dirección slot ${slot}`,
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
      status: "custom-development-required",
      concept: "Mapa interactivo de zonas de cobertura.",
      businessValue: "Permite al visitante confirmar cobertura sin llamar.",
      requiredData: ["polígonos de zonas", "colonias atendidas"],
      estimatedComplexity: "medium",
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
    ...overrides,
  } as Direccion;
}

describe("buildCreativeDirectionsDomainSchema — modo full", () => {
  const domainSchema = buildCreativeDirectionsDomainSchema({ mode: "full" });

  it("acepta 3 direcciones con slots 1,2,3 y títulos únicos", () => {
    const result = domainSchema.safeParse({
      direcciones: [direccionFixture(1), direccionFixture(2), direccionFixture(3)],
    });
    expect(result.success).toBe(true);
  });

  it("rechaza slots duplicados (1,1,2)", () => {
    const result = domainSchema.safeParse({
      direcciones: [direccionFixture(1), direccionFixture(1), direccionFixture(2)],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join(".") === "direcciones.1.slot")).toBe(true);
    }
  });

  it("rechaza cuando no son exactamente 3 (2 direcciones)", () => {
    const result = domainSchema.safeParse({
      direcciones: [direccionFixture(1), direccionFixture(2)],
    });
    expect(result.success).toBe(false);
  });

  it("rechaza títulos duplicados (case-insensitive, trim)", () => {
    const result = domainSchema.safeParse({
      direcciones: [
        direccionFixture(1, { title: "Dirección Editorial" }),
        direccionFixture(2, { title: "  dirección EDITORIAL  " }),
        direccionFixture(3),
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join(".") === "direcciones.1.title")).toBe(true);
    }
  });

  it("rechaza un capabilityId inexistente en el Signature Capability Registry", () => {
    const result = domainSchema.safeParse({
      direcciones: [
        direccionFixture(1, {
          signatureComponent: {
            status: "capability",
            capabilityId: "no-existe-v1",
            concepto: "Selector de opciones.",
            configuracionInicial: "Config inicial.",
            datosRequeridos: ["catálogo"],
          },
        }),
        direccionFixture(2),
        direccionFixture(3),
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path.join(".") === "direcciones.0.signatureComponent.capabilityId")
      ).toBe(true);
    }
  });

  it("acepta un capabilityId que sí existe en el registro", () => {
    const [firstCapabilityId] = CAPABILITY_IDS;
    const result = domainSchema.safeParse({
      direcciones: [
        direccionFixture(1, {
          signatureComponent: {
            status: "capability",
            capabilityId: firstCapabilityId,
            concepto: "Selector de opciones.",
            configuracionInicial: "Config inicial.",
            datosRequeridos: ["catálogo"],
          },
        }),
        direccionFixture(2),
        direccionFixture(3),
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe("buildCreativeDirectionsDomainSchema — modo slot (regeneración)", () => {
  it("acepta exactamente 1 dirección con el slot pedido", () => {
    const domainSchema = buildCreativeDirectionsDomainSchema({ mode: "slot", slot: 2 });
    const result = domainSchema.safeParse({ direcciones: [direccionFixture(2)] });
    expect(result.success).toBe(true);
  });

  it("rechaza cuando la dirección regenerada trae un slot distinto al pedido", () => {
    const domainSchema = buildCreativeDirectionsDomainSchema({ mode: "slot", slot: 2 });
    const result = domainSchema.safeParse({ direcciones: [direccionFixture(3)] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join(".") === "direcciones.0.slot")).toBe(true);
    }
  });

  it("rechaza más de 1 dirección en modo slot", () => {
    const domainSchema = buildCreativeDirectionsDomainSchema({ mode: "slot", slot: 1 });
    const result = domainSchema.safeParse({ direcciones: [direccionFixture(1), direccionFixture(2)] });
    expect(result.success).toBe(false);
  });
});
