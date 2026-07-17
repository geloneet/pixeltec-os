import { z } from "zod";

import { contextBriefSchema } from "@/lib/pixelforge/schemas/analyze-context";
import { landingDnaSchema } from "@/lib/pixelforge/schemas/generate-strategy";
import { visualDnaSchema } from "@/lib/pixelforge/schemas/synthesize-visual-dna";
import { directionDecisionSchema } from "@/lib/pixelforge/schemas/direction-decision";
import { narrativeBlueprintSchema } from "@/lib/pixelforge/schemas/build-narrative";
import type { OperativeArtifactKind } from "@/lib/pixelforge/types";

// Vive FUERA de `actions.ts` porque un archivo "use server" solo puede
// exportar funciones async — exportar estos objetos ahí rompe la compilación
// de Next en runtime (500 en toda página que importe el módulo), sin que
// typecheck ni vitest lo detecten (regla del bundler, no de TS). Gate F6A.
//
// El runtime (zod) se queda acotado a mano acá — el tipo compartido
// (`OperativeArtifactKind`, `@/lib/pixelforge/types`) es solo para el tipado
// estático, no reemplaza esta validación en tiempo de ejecución. F5 suma
// `direction_decision` — a diferencia de los otros 3 kinds, su draft NUNCA se
// escribe por `updateArtifactDraftAction` (ver el rechazo explícito en
// actions.ts); se incluye igual acá porque comparte sellado/reapertura
// genéricos por kind. F6A suma `narrative_blueprint` — a diferencia de
// `direction_decision`, SÍ es un draft editable normal (como `visual_dna`).
export const OPERATIVE_ARTIFACT_KIND = z.enum(
  ["context_brief", "landing_dna", "visual_dna", "direction_decision", "narrative_blueprint"],
  { errorMap: () => ({ message: "Tipo de artefacto inválido" }) }
) satisfies z.ZodType<OperativeArtifactKind>;

/** Mapa kind → schema de FORMA (zod v4 de `schemas/`) para validar el draft antes de persistir. */
export const KIND_SCHEMAS = {
  context_brief: contextBriefSchema,
  landing_dna: landingDnaSchema,
  visual_dna: visualDnaSchema,
  direction_decision: directionDecisionSchema,
  narrative_blueprint: narrativeBlueprintSchema,
} as const;
