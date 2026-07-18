/**
 * Matcher PURO de códigos postales para la capability `coverage-map-v1` (F6C).
 *
 * Sin React, sin DOM, sin red: lógica determinista y trivialmente testeable en
 * entorno node. El componente `CoverageMap` la consume para el buscador de CP.
 *
 * Reglas (D4):
 *  - Se normaliza la entrada a SOLO dígitos ("48 300" / "48-300" → "48300").
 *  - Entrada con menos de 5 dígitos tras normalizar → resultado `invalid`
 *    (distinto de `miss`: uno significa "escribe bien el CP", el otro "sí
 *    entendí tu CP pero no lo cubrimos"). Esta distinción es lo que permite al
 *    componente dar un aviso suave vs. el mensaje de fuera de cobertura.
 *  - Una zona matchea si alguno de sus `codigosPostales` (también normalizado):
 *      · tiene 5+ dígitos y es EXACTAMENTE igual al CP, o
 *      · tiene menos de 5 dígitos y es PREFIJO del CP.
 *  - DETERMINISMO: gana la PRIMERA zona en orden de array (y dentro de ella el
 *    primer código que matchee). El orden de `zonas` es la fuente de verdad del
 *    desempate; el llamador controla ese orden.
 *  - Defensa en profundidad: nunca lanza ante props degeneradas (zonas
 *    null/undefined, códigos vacíos, etc.).
 */

export interface CpMatchZona {
  nombre: string;
  codigosPostales?: string[];
}

/** Resultado discriminado: más testeable que `zona | null` (ver docstring). */
export type CpMatchResult =
  | { status: "match"; zona: CpMatchZona }
  | { status: "miss" }
  | { status: "invalid" };

/** Deja solo los dígitos de una cadena (o cadena vacía si no hay ninguno). */
function digitsOnly(value: string | undefined | null): string {
  return (value ?? "").replace(/\D+/g, "");
}

export function matchZonaByCp(cp: string, zonas: CpMatchZona[]): CpMatchResult {
  const cpDigits = digitsOnly(cp);
  if (cpDigits.length < 5) {
    return { status: "invalid" };
  }

  const lista = Array.isArray(zonas) ? zonas : [];
  for (const zona of lista) {
    const codigos = Array.isArray(zona?.codigosPostales) ? zona.codigosPostales : [];
    for (const raw of codigos) {
      const item = digitsOnly(raw);
      if (item.length === 0) continue;
      const matches = item.length >= 5 ? item === cpDigits : cpDigits.startsWith(item);
      if (matches) {
        return { status: "match", zona };
      }
    }
  }

  return { status: "miss" };
}
