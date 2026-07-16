/**
 * Cálculo del `scoreTotal` de una dirección creativa (F5, decisión de diseño
 * #4 del plan maestro) — SIEMPRE server-side en el repo, nunca confiado a la
 * aritmética del modelo (el schema de salida IA, `generate-directions.ts`,
 * lleva los 5 criterios pero NO `scoreTotal`).
 *
 * Los 5 criterios son 0-100, "más alto es mejor" — salvo
 * `riesgoGenericidadIA`, donde 100 = indistinguible de una plantilla de IA
 * (peor). Se invierte (`100 - riesgoGenericidadIA`) antes de promediar para
 * que los 5 términos apunten en la misma dirección.
 *
 * Función pura — sin DB, testeable directo.
 */
export interface DirectionScores {
  originalidadConceptual: number;
  independenciaDeReferencias: number;
  especificidadDelMotif: number;
  utilidadDelSignature: number;
  /** 0 = nada genérico, 100 = indistinguible de una plantilla de IA (peor). */
  riesgoGenericidadIA: number;
}

/** `round((suma de los 4 directos + (100 - riesgoGenericidadIA)) / 5)`. */
export function computeScoreTotal(scores: DirectionScores): number {
  const {
    originalidadConceptual,
    independenciaDeReferencias,
    especificidadDelMotif,
    utilidadDelSignature,
    riesgoGenericidadIA,
  } = scores;

  return Math.round(
    (originalidadConceptual +
      independenciaDeReferencias +
      especificidadDelMotif +
      utilidadDelSignature +
      (100 - riesgoGenericidadIA)) /
      5
  );
}
