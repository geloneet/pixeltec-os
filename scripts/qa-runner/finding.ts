/**
 * `buildNavFinding` — construye un `QaFindingInput` (T2) para un check `nav`
 * (T6) SIEMPRE leyendo `category`/`severity`/`blocking`/`title`/
 * `recommendation` del catálogo (`qa/catalog.ts`) — ningún check de T6
 * hardcodea esos valores, tal como exige el brief ("los findings usan
 * SIEMPRE severity/blocking del catálogo"). `severityOverride`/
 * `blockingOverride` solo existen para los 2 checks del plan que computan el
 * valor real por hallazgo (QA-AX-001 vía `AXE_IMPACT_TO_SEVERITY`, QA-TE-003
 * same-origin vs. externo) — nunca un valor arbitrario inventado por el
 * check, siempre trazable a una constante del catálogo.
 */
import { getCheckDefinition, type QaCheckSeverity } from "@/lib/pixelforge/qa/catalog";
import { buildLocationKey, type QaFindingLocation } from "@/lib/pixelforge/qa/location-key";
import type { QaFindingInput } from "@/lib/pixelforge/qa/catalog";

export interface BuildNavFindingInput {
  description: string;
  location?: QaFindingLocation;
  evidence?: unknown;
  /** Solo para checks que el catálogo documenta como "computan el valor real por hallazgo" (QA-AX-001, QA-TE-003). */
  severityOverride?: QaCheckSeverity;
  blockingOverride?: boolean;
}

export function buildNavFinding(code: string, input: BuildNavFindingInput): QaFindingInput {
  const def = getCheckDefinition(code);
  if (!def) {
    // Nunca debería pasar (los checks de T6 solo invocan códigos reales del
    // catálogo) — un throw acá es preferible a persistir un finding con
    // metadata inventada.
    throw new Error(`qa-runner: código de check desconocido en el catálogo: ${code}`);
  }

  const blocking = input.blockingOverride ?? (def.blocking === true);

  return {
    checkCode: code,
    category: def.category,
    severity: input.severityOverride ?? def.severity,
    blocking,
    source: "nav",
    title: def.title,
    description: input.description,
    recommendation: def.recommendation,
    evidence: input.evidence,
    location: input.location,
    locationKey: buildLocationKey(code, input.location),
  };
}
