/**
 * `buildQaPreviewUrl` — URL exacta que el qa-runner (PF-F8 T6) navega para
 * cada job: la rama `?pfqa=` de `/proyectos/pixelforge/[id]/preview` (T3),
 * sobre el origin interno (`QA_INTERNAL_APP_URL`, p.ej. `http://app:3000`).
 * Módulo puro — sin red, sin `fetch` — separado de `index.ts` únicamente para
 * poder testearlo sin levantar un browser.
 */

/**
 * Construye `${appBaseUrl}/proyectos/pixelforge/${projectId}/preview?pfqa=${token}`.
 * `appBaseUrl` SIN trailing slash (contrato de `loadQaRunnerEnv`); el token se
 * pasa YA firmado (`signQaPreviewToken`) — esta función no firma nada, solo
 * ensambla la URL. `encodeURIComponent` en `projectId`/`token` por higiene
 * (el token es base64url + un punto, ya URL-safe, pero mejor no asumirlo).
 */
export function buildQaPreviewUrl(appBaseUrl: string, projectId: string, token: string): string {
  const base = appBaseUrl.replace(/\/+$/, "");
  return `${base}/proyectos/pixelforge/${encodeURIComponent(projectId)}/preview?pfqa=${encodeURIComponent(token)}`;
}
