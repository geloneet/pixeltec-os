/**
 * Política de ejecución de trabajos programados — fail-closed.
 *
 * Es un control **distinto** del egress, no una extensión suya. `egress-guard`
 * decide si una salida concreta hacia un tercero está permitida; esto decide si
 * el trabajo llega siquiera a empezar. Por eso no comparte tipos ni canales.
 *
 * El problema que resuelve: las siete rutas cron autenticaban con `CRON_SECRET`
 * y nada más. Conocer el secreto bastaba para dispararlas en cualquier entorno,
 * y varias iteran usuarios, cargan lotes y escriben estado **antes** de llegar a
 * las fronteras de egress. Bloquear ahí llegaba tarde: el trabajo ya había
 * consultado y mutado datos.
 *
 * Autenticación y autorización de ejecución son controles separados a propósito:
 * saber el secreto no habilita el cron cuando el modo está deshabilitado.
 *
 * La guarda nunca lee ni registra `CRON_SECRET`.
 */

export type CronExecutionMode = "disabled" | "enabled";

export type CronBlockReason =
  | "mode_disabled"
  | "mode_invalid"
  | "enabled_outside_production";

/** Error tipado y estable. No transporta configuración ni secretos. */
export class CronExecutionBlockedError extends Error {
  readonly code = "CRON_EXECUTION_BLOCKED" as const;
  readonly reason: CronBlockReason;

  constructor(reason: CronBlockReason) {
    super(`CRON_EXECUTION_BLOCKED: ${reason}`);
    this.name = "CronExecutionBlockedError";
    this.reason = reason;
  }
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Solo `true` autoriza, tras trim + lowercase. Nada más cuenta. */
function flagIsTrue(name: string): boolean {
  return (process.env[name] ?? "").trim().toLowerCase() === "true";
}

/**
 * Lanza si la ejecución programada no está autorizada en este entorno.
 *
 * Debe invocarse **después** de validar el secreto —para que una llamada sin
 * credencial siga recibiendo 401 y no aprenda si el cron está activo— y
 * **antes** de cualquier consulta, iteración, escritura o llamada externa.
 */
export function assertCronExecutionAllowed(): void {
  const raw = process.env.CRON_EXECUTION_MODE;

  // Ausente equivale a deshabilitado: un entorno sin configurar no ejecuta.
  if (raw === undefined) throw new CronExecutionBlockedError("mode_disabled");

  const mode = raw.trim().toLowerCase();
  // Presente pero inválido no cae al default: sería degradar un error de
  // configuración a permiso.
  if (mode !== "disabled" && mode !== "enabled") {
    throw new CronExecutionBlockedError("mode_invalid");
  }
  if (mode === "disabled") throw new CronExecutionBlockedError("mode_disabled");

  if (isProduction()) return;
  if (flagIsTrue("CRON_ALLOW_OUTSIDE_PRODUCTION")) return;
  throw new CronExecutionBlockedError("enabled_outside_production");
}

/**
 * Traduce un bloqueo de ejecución a respuesta HTTP estable.
 *
 * Devuelve `null` para cualquier otro error, de modo que el llamador lo
 * propague: esto no es un catch-all y no debe enmascarar fallos reales.
 *
 * 503 y no 403: el trabajo no se rechaza por falta de permisos del llamador
 * —ese caso ya lo cubre el 401 del secreto— sino porque este entorno no ejecuta
 * cron. El cuerpo lleva solo el código, sin configuración ni motivo detallado.
 */
export function cronBlockedResponse(error: unknown): Response | null {
  if (!(error instanceof CronExecutionBlockedError)) return null;
  return Response.json({ error: error.code }, { status: 503 });
}
