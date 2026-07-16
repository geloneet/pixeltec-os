// @vitest-environment jsdom
// src/components/pixelforge/DirectionCard.test.tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DirectionCard, type DirectionCardView } from "./DirectionCard";

afterEach(() => {
  cleanup();
});

function fixtureDirection(overrides: Partial<DirectionCardView> = {}): DirectionCardView {
  return {
    id: "dir-1",
    slot: 1,
    title: "Editorial de confianza",
    concept: "Landing editorial con foco en credibilidad técnica.",
    designTokens: {
      paleta: [
        { token: "color-primario", valor: "#0F172A", uso: "Fondos oscuros y texto principal." },
        { token: "color-fondo", valor: "#FFFFFF", uso: "Fondo general." },
        { token: "color-acento", valor: "#F59E0B", uso: "CTAs." },
      ],
      tipografia: { display: "Fraunces", body: "Inter", escala: "Modular 1.25, base 16px" },
      radios: "suaves",
      espaciado: "equilibrado",
    },
    motionDna: {
      personalidad: "Preciso y mecánico",
      ritmo: "moderado",
      intensidadGlobal: 2,
      firmas: ["Entradas escalonadas"],
    },
    signatureMotif: {
      nombre: "Trazo de cobertura",
      descripcion: "Línea que dibuja el área de servicio.",
      aplicaciones: ["hero", "sección de zonas"],
    },
    signatureComponent: {
      status: "capability",
      capabilityId: "coverage-map-v1",
      concepto: "Mapa de zonas interactivo.",
      configuracionInicial: "3 zonas iniciales.",
      datosRequeridos: ["colonias atendidas"],
    },
    scores: {
      originalidadConceptual: 70,
      independenciaDeReferencias: 65,
      especificidadDelMotif: 80,
      utilidadDelSignature: 75,
      riesgoGenericidadIA: 30,
      scoresRazones: { porCriterio: "Alta originalidad por el motif propio." },
      risks: ["Puede requerir ajustar tipografía en móvil."],
    },
    scoreTotal: 72,
    status: "candidate",
    ...overrides,
  };
}

describe("DirectionCard", () => {
  it("renderiza título, concepto, tokens de paleta y tipografía", () => {
    render(
      <DirectionCard direction={fixtureDirection()} capabilityNames={{}} editable={true} />
    );
    expect(screen.getByText("Editorial de confianza")).toBeInTheDocument();
    expect(screen.getByText(/Landing editorial con foco en credibilidad técnica/)).toBeInTheDocument();
    expect(screen.getByText("color-primario")).toBeInTheDocument();
    expect(screen.getByText(/Fraunces \/ Inter/)).toBeInTheDocument();
  });

  it("renderiza las 5 barras de score y el scoreTotal prominente", () => {
    render(
      <DirectionCard direction={fixtureDirection()} capabilityNames={{}} editable={true} />
    );
    expect(screen.getByText("Originalidad conceptual")).toBeInTheDocument();
    expect(screen.getByText("Independencia de referencias")).toBeInTheDocument();
    expect(screen.getByText("Especificidad del motif")).toBeInTheDocument();
    expect(screen.getByText("Utilidad del signature")).toBeInTheDocument();
    expect(screen.getByText("Riesgo de genericidad IA")).toBeInTheDocument();
    expect(screen.getByText("72")).toBeInTheDocument();
  });

  it("razones de scores colapsadas por default; se expanden con el botón Razones", () => {
    render(
      <DirectionCard direction={fixtureDirection()} capabilityNames={{}} editable={true} />
    );
    expect(screen.queryByText(/Alta originalidad por el motif propio/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Razones"));
    expect(screen.getByText(/Alta originalidad por el motif propio/)).toBeInTheDocument();
  });

  it("signatureComponent capability: muestra el nombre resuelto vía capabilityNames", () => {
    render(
      <DirectionCard
        direction={fixtureDirection()}
        capabilityNames={{ "coverage-map-v1": "Mapa de cobertura de zonas de servicio" }}
        editable={true}
      />
    );
    expect(screen.getByText("Mapa de cobertura de zonas de servicio")).toBeInTheDocument();
  });

  it("signatureComponent custom-development-required: badge ámbar + businessValue + complejidad", () => {
    render(
      <DirectionCard
        direction={fixtureDirection({
          signatureComponent: {
            status: "custom-development-required",
            concept: "Selector de refacciones.",
            businessValue: "Reduce llamadas de soporte.",
            requiredData: ["catálogo técnico"],
            estimatedComplexity: "high",
          },
        })}
        capabilityNames={{}}
        editable={true}
      />
    );
    expect(screen.getByText("Desarrollo custom requerido")).toBeInTheDocument();
    expect(screen.getByText("Reduce llamadas de soporte.")).toBeInTheDocument();
    expect(screen.getByText(/Complejidad estimada: high/)).toBeInTheDocument();
  });

  it("riesgoGenericidadIA >= 60: muestra alerta visible", () => {
    render(
      <DirectionCard
        direction={fixtureDirection({
          scores: {
            originalidadConceptual: 40,
            independenciaDeReferencias: 35,
            especificidadDelMotif: 30,
            utilidadDelSignature: 40,
            riesgoGenericidadIA: 75,
            scoresRazones: { porCriterio: "Muy cercano a plantillas genéricas." },
            risks: [],
          },
        })}
        capabilityNames={{}}
        editable={true}
      />
    );
    expect(screen.getByText(/Riesgo de genericidad IA alto/)).toBeInTheDocument();
  });

  it("riesgoGenericidadIA < 60: no muestra la alerta", () => {
    render(
      <DirectionCard direction={fixtureDirection()} capabilityNames={{}} editable={true} />
    );
    expect(screen.queryByText(/Riesgo de genericidad IA alto/)).not.toBeInTheDocument();
  });

  it("status chosen: muestra badge Elegida", () => {
    render(
      <DirectionCard
        direction={fixtureDirection({ status: "chosen" })}
        capabilityNames={{}}
        editable={true}
      />
    );
    expect(screen.getByText("Elegida")).toBeInTheDocument();
  });

  it("status discarded: muestra badge Descartada", () => {
    render(
      <DirectionCard
        direction={fixtureDirection({ status: "discarded" })}
        capabilityNames={{}}
        editable={true}
      />
    );
    expect(screen.getByText("Descartada")).toBeInTheDocument();
  });

  it("status candidate: no muestra ningún badge de status", () => {
    render(
      <DirectionCard direction={fixtureDirection()} capabilityNames={{}} editable={true} />
    );
    expect(screen.queryByText("Elegida")).not.toBeInTheDocument();
    expect(screen.queryByText("Descartada")).not.toBeInTheDocument();
  });

  it("editable=false: oculta los botones de acción", () => {
    render(
      <DirectionCard direction={fixtureDirection()} capabilityNames={{}} editable={false} />
    );
    expect(screen.queryByText("Elegir esta dirección")).not.toBeInTheDocument();
    expect(screen.queryByText("Regenerar")).not.toBeInTheDocument();
  });

  it("editable=true: click en Elegir esta dirección llama onChoose", () => {
    const onChoose = vi.fn();
    render(
      <DirectionCard
        direction={fixtureDirection()}
        capabilityNames={{}}
        editable={true}
        onChoose={onChoose}
      />
    );
    fireEvent.click(screen.getByText("Elegir esta dirección"));
    expect(onChoose).toHaveBeenCalledTimes(1);
  });

  it("Regenerar exige confirmación antes de llamar onRegenerate", () => {
    const onRegenerate = vi.fn();
    render(
      <DirectionCard
        direction={fixtureDirection()}
        capabilityNames={{}}
        editable={true}
        onRegenerate={onRegenerate}
      />
    );
    fireEvent.click(screen.getByText("Regenerar"));
    expect(onRegenerate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Confirmar"));
    expect(onRegenerate).toHaveBeenCalledTimes(1);
  });

  it("actionsDisabled=true: deshabilita Regenerar y Elegir", () => {
    render(
      <DirectionCard
        direction={fixtureDirection()}
        capabilityNames={{}}
        editable={true}
        actionsDisabled={true}
      />
    );
    expect(screen.getByText("Regenerar").closest("button")).toBeDisabled();
    expect(screen.getByText("Elegir esta dirección").closest("button")).toBeDisabled();
  });
});
