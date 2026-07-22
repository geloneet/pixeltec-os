/**
 * Mapeo `impact` de axe-core → severidad de QA (QA-AX-001, T6). La tabla
 * REAL vive en el catálogo (`AXE_IMPACT_TO_SEVERITY`, `qa/catalog.ts`) — este
 * módulo es solo el punto de entrada tipado que el check de axe usa, con un
 * default explícito (`"info"`) para un `impact` que axe-core pudiera reportar
 * como `null`/algo fuera de las 4 categorías documentadas (nunca debe pasar
 * en axe-core 4.x, pero un `impact` desconocido jamás debe tumbar el check).
 */
import { AXE_IMPACT_TO_SEVERITY, type QaCheckSeverity } from "@/lib/pixelforge/qa/catalog";

export function severityForAxeImpact(impact: string | null | undefined): QaCheckSeverity {
  if (!impact) return "info";
  return (AXE_IMPACT_TO_SEVERITY as Record<string, QaCheckSeverity>)[impact] ?? "info";
}
