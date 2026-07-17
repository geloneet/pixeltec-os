import { describe, expect, it, vi } from "vitest";

// `actions.ts` importa `@/lib/auth/config` (next-auth) — bajo Vitest (Node ESM
// puro, sin el resolutor de módulos de Next) el propio `next-auth` rompe al
// intentar importar "next/server" (mismo mock que `runs/route.test.ts`). Solo
// necesitamos `KIND_SCHEMAS`/`OPERATIVE_ARTIFACT_KIND`, que no dependen de
// auth — mockeamos para poder importar el módulo sin arrastrar next-auth.
vi.mock("@/lib/auth/config", () => ({ auth: vi.fn() }));

import { KIND_SCHEMAS, OPERATIVE_ARTIFACT_KIND } from "./actions";
import type { OperativeArtifactKind } from "@/lib/pixelforge/types";

const OPERATIVE_KINDS: OperativeArtifactKind[] = [
  "context_brief",
  "landing_dna",
  "visual_dna",
  "direction_decision",
  "narrative_blueprint",
];

describe("OPERATIVE_ARTIFACT_KIND / KIND_SCHEMAS (F6A: narrative_blueprint operativo)", () => {
  it("el enum runtime acepta narrative_blueprint", () => {
    expect(OPERATIVE_ARTIFACT_KIND.safeParse("narrative_blueprint").success).toBe(true);
  });

  it("el enum runtime sigue rechazando kinds no operativos", () => {
    expect(OPERATIVE_ARTIFACT_KIND.safeParse("compose_page_tree").success).toBe(false);
    expect(OPERATIVE_ARTIFACT_KIND.safeParse("").success).toBe(false);
  });

  it("KIND_SCHEMAS registra narrative_blueprint", () => {
    expect(KIND_SCHEMAS.narrative_blueprint).toBeDefined();
    expect(typeof KIND_SCHEMAS.narrative_blueprint.safeParse).toBe("function");
  });

  it("KIND_SCHEMAS tiene paridad exacta con los 5 kinds operativos declarados (mismo criterio que registry.test.ts)", () => {
    expect(Object.keys(KIND_SCHEMAS).sort()).toEqual([...OPERATIVE_KINDS].sort());
  });

  it("safeParse de un objeto vacío en narrative_blueprint NO revienta el runtime — solo devuelve error", () => {
    expect(() => KIND_SCHEMAS.narrative_blueprint.safeParse({})).not.toThrow();
    expect(KIND_SCHEMAS.narrative_blueprint.safeParse({}).success).toBe(false);
  });

  it("KIND_SCHEMAS.narrative_blueprint acepta un blueprint válido completo", () => {
    const result = KIND_SCHEMAS.narrative_blueprint.safeParse({
      historia: "La landing cuenta la historia de un rescate en 30 minutos.",
      actos: [
        {
          orden: 1,
          proposito: "Enganchar",
          mensaje: "Estás atrapado afuera",
          tension: "Miedo a quedarse fuera de casa",
          resolucion: "Llegamos en 30 minutos o menos",
        },
        {
          orden: 2,
          proposito: "Generar confianza",
          mensaje: "Somos técnicos certificados",
          tension: "Desconfianza en un desconocido con llaves",
          resolucion: "Perfil verificado del técnico antes de que llegue",
        },
        {
          orden: 3,
          proposito: "Convertir",
          mensaje: "Llama ahora",
          tension: "Duda sobre el precio de emergencia",
          resolucion: "Precio fijo garantizado antes de salir",
        },
      ],
      cinematicMoments: [
        {
          actoOrden: 1,
          descripcion: "Reloj de arena digital que corre en el hero desde el primer scroll",
          motifConnection: "Dramatiza el countdown de 30 minutos, el Signature Motif de la dirección elegida.",
        },
      ],
      notasProduccion: ["Usar un timer real en JS, no una animación en loop estática."],
    });

    expect(result.success).toBe(true);
  });

  it("KIND_SCHEMAS.narrative_blueprint rechaza actos con orden no consecutivo (superRefine inline del schema)", () => {
    const result = KIND_SCHEMAS.narrative_blueprint.safeParse({
      historia: "Historia mínima.",
      actos: [
        { orden: 1, proposito: "p", mensaje: "m", tension: "t", resolucion: "r" },
        { orden: 3, proposito: "p", mensaje: "m", tension: "t", resolucion: "r" },
        { orden: 4, proposito: "p", mensaje: "m", tension: "t", resolucion: "r" },
      ],
      cinematicMoments: [],
      notasProduccion: [],
    });

    expect(result.success).toBe(false);
  });
});
