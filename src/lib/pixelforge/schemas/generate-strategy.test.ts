import { describe, expect, it } from "vitest";
import { landingDnaDomainSchema, type LandingDna } from "./generate-strategy";

function baseDna(overrides: Partial<LandingDna> = {}): LandingDna {
  return {
    propuestaValor: "La remodeladora que entrega a tiempo y sin sorpresas en el presupuesto.",
    audiencia: {
      descripcion: "Dueños de casa en zonas residenciales que ya cotizaron y se quedaron con dudas.",
      dolores: ["Miedo a que el proyecto se alargue más de lo prometido"],
      objeciones: ["¿Y si el presupuesto final no es el que me dijeron?"],
    },
    tono: {
      voz: "Cercano y directo, sin tecnicismos de construcción.",
      atributos: ["confiable", "claro"],
    },
    mensajesClave: [
      {
        mensaje: "Entregamos en el plazo pactado o no cobramos el excedente.",
        evidencias: [{ sourceRef: "brief", cita: "garantía de plazo pactado" }],
      },
    ],
    llamadosAccion: [{ texto: "Cotiza tu remodelación", intencion: "cotizacion" }],
    evidencias: [{ sourceRef: "braindump", cita: "hacemos remodelaciones de casas" }],
    ...overrides,
  };
}

describe("landingDnaDomainSchema", () => {
  it("acepta un Landing DNA completo válido", () => {
    const result = landingDnaDomainSchema.safeParse(baseDna());
    expect(result.success).toBe(true);
  });

  it("rechaza un mensaje clave sin evidencias", () => {
    const dna = baseDna({
      mensajesClave: [
        {
          mensaje: "Entregamos en el plazo pactado o no cobramos el excedente.",
          evidencias: [],
        },
      ],
    });

    const result = landingDnaDomainSchema.safeParse(dna);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path.join(".") === "mensajesClave.0.evidencias")
      ).toBe(true);
    }
  });

  it("rechaza cuando las evidencias globales están vacías", () => {
    const dna = baseDna({ evidencias: [] });

    const result = landingDnaDomainSchema.safeParse(dna);

    // La forma base ya exige `.min(1)` en `evidencias` — el refine de dominio
    // re-chequea lo mismo a mano (ver docstring), así que sigue rechazando.
    expect(result.success).toBe(false);
  });

  it("rechaza llamados a la acción con textos duplicados (case-insensitive, trim)", () => {
    const dna = baseDna({
      llamadosAccion: [
        { texto: "Cotiza tu remodelación", intencion: "cotizacion" },
        { texto: "  cotiza TU remodelación  ", intencion: "contacto" },
      ],
    });

    const result = landingDnaDomainSchema.safeParse(dna);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path.join(".") === "llamadosAccion.1.texto")
      ).toBe(true);
    }
  });

  it("acepta llamados a la acción con textos distintos", () => {
    const dna = baseDna({
      llamadosAccion: [
        { texto: "Cotiza tu remodelación", intencion: "cotizacion" },
        { texto: "Agenda una visita", intencion: "agenda" },
      ],
    });

    const result = landingDnaDomainSchema.safeParse(dna);

    expect(result.success).toBe(true);
  });
});
