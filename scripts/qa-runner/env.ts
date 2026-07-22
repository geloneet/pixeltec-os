/**
 * Validación de entorno del qa-runner (PF-F8 T6) — arranca el proceso una
 * sola vez, ANTES de entrar al loop de poll. Aborta con un mensaje claro (una
 * línea por variable faltante) si falta algo — nunca deja que un
 * `process.env.X!` explote más abajo con un stack trace opaco.
 *
 * Las claves de R2 se leen aquí con el MISMO nombre que valida
 * `@/lib/r2/client.ts` (`R2_ENDPOINT`/`R2_ACCESS_KEY_ID`/
 * `R2_SECRET_ACCESS_KEY`/`R2_BUCKET_NAME`/`R2_PUBLIC_URL`) — ese módulo ya las
 * valida perezosamente (por llamada), pero el runner las exige TODAS al
 * arrancar para fallar rápido en vez de a mitad del primer job.
 */

export interface QaRunnerEnv {
  databaseUrl: string;
  previewTokenSecret: string;
  /**
   * p.ej. `http://pixeltec-os:3000` — origin interno del preview, SIN
   * trailing slash. JAMÁS `http://app:3000`: el hostname `app` matchea la
   * entrada HSTS-preload del TLD `.app` embebida en Chromium (fuerza https
   * → net::ERR_SSL_PROTOCOL_ERROR contra HTTP plano, sin flag para
   * apagarlo). Ver .env.production.example.
   */
  appBaseUrl: string;
  r2Endpoint: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2BucketName: string;
  r2PublicUrl: string;
}

const REQUIRED_KEYS = [
  "DATABASE_URL",
  "QA_PREVIEW_TOKEN_SECRET",
  "QA_INTERNAL_APP_URL",
  "R2_ENDPOINT",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_URL",
] as const;

/** Quita cualquier `/` final — `buildQaPreviewUrl` siempre añade el suyo. */
function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

/**
 * Lee y valida las variables de entorno requeridas por el qa-runner desde
 * `env` (por defecto `process.env`, inyectable para test). Lanza un único
 * `Error` con TODAS las claves faltantes (una por línea) — no solo la
 * primera — así quien arranca el contenedor ve el problema completo de una.
 */
export function loadQaRunnerEnv(env: Record<string, string | undefined> = process.env): QaRunnerEnv {
  const missing = REQUIRED_KEYS.filter((key) => !env[key] || env[key]!.trim() === "");
  if (missing.length > 0) {
    throw new Error(
      `qa-runner: faltan variables de entorno requeridas:\n${missing.map((k) => `  - ${k}`).join("\n")}`
    );
  }

  return {
    databaseUrl: env.DATABASE_URL!,
    previewTokenSecret: env.QA_PREVIEW_TOKEN_SECRET!,
    appBaseUrl: stripTrailingSlash(env.QA_INTERNAL_APP_URL!),
    r2Endpoint: env.R2_ENDPOINT!,
    r2AccessKeyId: env.R2_ACCESS_KEY_ID!,
    r2SecretAccessKey: env.R2_SECRET_ACCESS_KEY!,
    r2BucketName: env.R2_BUCKET_NAME!,
    r2PublicUrl: env.R2_PUBLIC_URL!,
  };
}
