import { describe, expect, it } from "vitest";
import { contextBriefDomainSchema, type ContextBrief } from "./analyze-context";

function baseBrief(overrides: Partial<ContextBrief> = {}): ContextBrief {
  return {
    confirmados: [],
    inferidos: [],
    faltantes: [],
    contradicciones: [],
    resumen: "Landing para una constructora que ofrece remodelaciones residenciales.",
    ...overrides,
  };
}

describe("contextBriefDomainSchema", () => {
  it("acepta un brief completo válido (confirmados/contradicciones con evidencia, faltantes sin evidencia)", () => {
    const brief = baseBrief({
      confirmados: [
        {
          titulo: "Rubro",
          detalle: "La empresa se dedica a remodelaciones residenciales.",
          confianza: "alta",
          evidencias: [{ sourceRef: "braindump", cita: "hacemos remodelaciones de casas" }],
        },
      ],
      inferidos: [
        {
          titulo: "Ticket promedio",
          detalle: "Posiblemente proyectos de gama media por el tono del texto.",
          confianza: "baja",
          evidencias: [],
        },
      ],
      faltantes: [
        {
          titulo: "Zona de cobertura",
          detalle: "No se menciona en qué ciudades opera.",
          confianza: "alta",
          evidencias: [],
        },
      ],
      contradicciones: [
        {
          titulo: "Nombre de la empresa",
          detalle: 'El braindump dice "Constructora ABC" pero el documento adjunto dice "ABC Remodelaciones".',
          confianza: "media",
          evidencias: [{ sourceRef: "source:11111111-1111-1111-1111-111111111111", cita: "ABC Remodelaciones S.A." }],
        },
      ],
    });

    const result = contextBriefDomainSchema.safeParse(brief);

    expect(result.success).toBe(true);
  });

  it("rechaza un ítem de confirmados sin evidencias", () => {
    const brief = baseBrief({
      confirmados: [
        {
          titulo: "Rubro",
          detalle: "La empresa se dedica a remodelaciones residenciales.",
          confianza: "alta",
          evidencias: [],
        },
      ],
    });

    const result = contextBriefDomainSchema.safeParse(brief);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join(".") === "confirmados.0.evidencias")).toBe(true);
    }
  });

  it("rechaza un ítem de contradicciones sin evidencias", () => {
    const brief = baseBrief({
      contradicciones: [
        {
          titulo: "Nombre de la empresa",
          detalle: "Discrepancia entre fuentes.",
          confianza: "media",
          evidencias: [],
        },
      ],
    });

    const result = contextBriefDomainSchema.safeParse(brief);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join(".") === "contradicciones.0.evidencias")).toBe(true);
    }
  });

  it("rechaza un ítem de faltantes CON evidencias (si hay evidencia, no está faltando)", () => {
    const brief = baseBrief({
      faltantes: [
        {
          titulo: "Zona de cobertura",
          detalle: "No se menciona en qué ciudades opera.",
          confianza: "alta",
          evidencias: [{ sourceRef: "braindump", cita: "operamos en toda la república" }],
        },
      ],
    });

    const result = contextBriefDomainSchema.safeParse(brief);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join(".") === "faltantes.0.evidencias")).toBe(true);
    }
  });

  it("acepta un ítem de faltantes SIN evidencias", () => {
    const brief = baseBrief({
      faltantes: [
        {
          titulo: "Zona de cobertura",
          detalle: "No se menciona en qué ciudades opera.",
          confianza: "alta",
          evidencias: [],
        },
      ],
    });

    const result = contextBriefDomainSchema.safeParse(brief);

    expect(result.success).toBe(true);
  });

  it("rechaza un brief totalmente vacío (0 ítems en las 4 listas)", () => {
    const result = contextBriefDomainSchema.safeParse(baseBrief());

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.length === 0)).toBe(true);
    }
  });
});
