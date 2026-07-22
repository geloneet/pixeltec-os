/**
 * Cablea `decideRequest` (`security.ts`, puro) a `page.route` de Playwright —
 * el único punto donde la decisión de allowlist realmente aborta/continúa
 * una request real. Sin bypass: se registra ANTES de cualquier
 * `page.goto`/`page.reload` de la pasada, sobre TODAS las rutas (`**\/*`), sin
 * excepciones por método ni por patrón adicional.
 */
import type { Page, Route } from "playwright";
import { decideRequest } from "./security";

export interface BlockedRequestEvent {
  url: string;
  resourceType: string;
  reason: string;
}

/**
 * Instala el gate de egress en `page`. `onBlocked` (opcional) se invoca por
 * cada request abortada — el caller lo usa para alimentar QA-TE-003 con las
 * imágenes externas que SÍ se permitieron pero fallaron no se reportan acá
 * (eso lo captura `collectors.ts` vía `requestfailed`/`response`, no este
 * gate — este gate solo decide permitir/abortar).
 */
export async function installEgressAllowlist(
  page: Page,
  allowedOrigin: string,
  onBlocked?: (event: BlockedRequestEvent) => void
): Promise<void> {
  await page.route("**/*", (route: Route) => {
    const request = route.request();
    const decision = decideRequest(request.url(), request.resourceType(), allowedOrigin);
    if (decision.allow) {
      route.continue().catch(() => {});
      return;
    }
    onBlocked?.({ url: request.url(), resourceType: request.resourceType(), reason: decision.reason });
    route.abort("blockedbyclient").catch(() => {});
  });
}
