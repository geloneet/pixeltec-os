/**
 * Reglas de aceptación de riesgo para aprobar una review con veredicto
 * `pass_with_warnings` (PF-F9). Encapsulan, verbatim, las condiciones del GO
 * de Miguel: solo se puede aceptar riesgo sobre findings REALES del `qa_run`
 * anclado, con justificación, jamás sobre un finding bloqueante, y toda
 * severidad `major` debe quedar cubierta antes de que la aprobación proceda.
 *
 * Sin DB, sin fecha del sistema, sin red — 100% puro y testeable en memoria.
 * `acceptedAt` en `AcceptedRiskEntry` es un string ISO que el CALLER produce
 * (este módulo nunca lee el reloj); acá solo se valida forma y coherencia.
 */

export interface FindingLike {
  id: string;
  checkCode: string;
  severity: "critical" | "major" | "minor" | "info";
  blocking: boolean;
}

export interface AcceptedRiskEntry {
  findingId: string;
  qaRunId: string;
  checkCode: string;
  severity: string;
  rationale: string;
  acceptedById: string | null;
  acceptedByName: string;
  acceptedAt: string;
}

/**
 * Findings que REQUIEREN aceptación explícita para que una review con
 * veredicto `pass_with_warnings` pueda aprobarse: los de severity `major`.
 * `pass` no exige ningún riesgo aceptado (no hubo warnings) y `fail` tampoco
 * — un `fail` nunca se aprueba, así que "qué requiere" es una pregunta sin
 * objeto (`validateAcceptedRisks` lo rechaza de entrada, ver abajo).
 *
 * Los findings `blocking` o `critical` NO aparecen acá porque, por
 * construcción del scoring de QA, cualquier finding bloqueante fuerza
 * `verdict='fail'` — un `pass_with_warnings` real nunca trae uno. Por
 * defensa (nunca confiar ciegamente en esa invariante ajena),
 * `validateAcceptedRisks` igual rechaza cualquier intento de aceptar riesgo
 * sobre un finding bloqueante o crítico, aparezca o no en este listado.
 */
export function requiredRiskFindings(
  verdict: "pass" | "pass_with_warnings" | "fail",
  findings: FindingLike[]
): FindingLike[] {
  if (verdict !== "pass_with_warnings") return [];
  return findings.filter((f) => f.severity === "major");
}

/**
 * Valida la lista de riesgos aceptados que se enviaría junto con una
 * aprobación. Reglas, en el orden en que se comprueban (la primera que
 * falla determina el mensaje):
 *
 * 0. `verdict === "fail"` → siempre inválido; un QA fallido no se aprueba
 *    nunca, sin importar qué riesgos se intenten aceptar.
 * Por cada entry, en orden:
 *   a. `entry.qaRunId` debe coincidir con `anchoredQaRunId` — jamás se
 *      acepta riesgo "prestado" de otro run.
 *   b. `entry.findingId` debe existir entre `findings` (el run anclado) —
 *      nunca un id inventado o de otro run.
 *   c. El finding referenciado NUNCA puede ser `blocking` ni severity
 *      `critical` — un bloqueante o crítico jamás es aceptable como riesgo,
 *      sin excepción.
 *   d. `rationale` (trim) debe tener al menos 5 caracteres — no se acepta
 *      riesgo sin una justificación mínima.
 * Al final: todos los `requiredRiskFindings(verdict, findings)` deben
 * quedar cubiertos por algún `entry.findingId` — no se aprueba con un
 * `major` sin decisión.
 */
export function validateAcceptedRisks(input: {
  verdict: "pass" | "pass_with_warnings" | "fail";
  anchoredQaRunId: string;
  findings: FindingLike[];
  entries: AcceptedRiskEntry[];
}): { ok: true } | { ok: false; error: string } {
  const { verdict, anchoredQaRunId, findings, entries } = input;

  if (verdict === "fail") {
    return { ok: false, error: "No se puede aprobar una revisión cuyo QA resultó en fail." };
  }

  const findingsById = new Map(findings.map((f) => [f.id, f]));

  for (const entry of entries) {
    if (entry.qaRunId !== anchoredQaRunId) {
      return {
        ok: false,
        error: `El riesgo aceptado para el finding "${entry.findingId}" referencia un qa_run distinto al anclado.`,
      };
    }

    const finding = findingsById.get(entry.findingId);
    if (!finding) {
      return {
        ok: false,
        error: `El finding "${entry.findingId}" no existe en el qa_run anclado.`,
      };
    }

    if (finding.blocking || finding.severity === "critical") {
      return {
        ok: false,
        error: `El finding "${entry.findingId}" es bloqueante o crítico y no puede aceptarse como riesgo.`,
      };
    }

    if (entry.rationale.trim().length < 5) {
      return {
        ok: false,
        error: `La justificación del riesgo aceptado para "${entry.findingId}" es demasiado corta (mínimo 5 caracteres).`,
      };
    }
  }

  const acceptedIds = new Set(entries.map((e) => e.findingId));
  const uncovered = requiredRiskFindings(verdict, findings).filter((f) => !acceptedIds.has(f.id));
  if (uncovered.length > 0) {
    return {
      ok: false,
      error: `Faltan riesgos por aceptar antes de aprobar: ${uncovered.map((f) => f.id).join(", ")}.`,
    };
  }

  return { ok: true };
}
