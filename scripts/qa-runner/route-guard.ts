/**
 * Cablea `decideRequest` (`security.ts`, puro) a `page.route` de Playwright —
 * el único punto donde la decisión de allowlist realmente aborta/continúa
 * una request real. Sin bypass: se registra ANTES de cualquier
 * `page.goto`/`page.reload` de la pasada, sobre TODAS las rutas (`**\/*`), sin
 * excepciones por método ni por patrón adicional.
 *
 * Gap encontrado en review (PF-F8 T6): `page.route()` NO intercepta el
 * handshake de WebSocket (`ws(s)://`) — Playwright lo enruta con una API
 * dedicada, `page.routeWebSocket` (ver `installWebSocketBlock` abajo). Sin
 * ese segundo gate, una página del preview podría abrir un WebSocket hacia
 * un host externo y escapar por completo esta allowlist, violando el req. 14
 * (cero egress). Mismo gap teórico con service workers — ese se cierra en
 * `run-job.ts` con `serviceWorkers: 'block'` en cada `browser.newContext`,
 * no acá (no hay un "route" de service worker que interceptar).
 */
import type { Page, Route, WebSocketRoute } from "playwright";
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

/** Razón reportada para todo WebSocket bloqueado — ver política en `installWebSocketBlock`. */
export const WEBSOCKET_BLOCK_REASON = "websocket-blocked-all";

/**
 * Parte pura de la política de WebSocket: describe el intento bloqueado para
 * el mismo `BlockedRequestEvent` que usa el gate HTTP. Sin lógica de
 * host/origin a propósito — ver docstring de `installWebSocketBlock`.
 */
export function describeBlockedWebSocket(url: string): BlockedRequestEvent {
  return { url, resourceType: "websocket", reason: WEBSOCKET_BLOCK_REASON };
}

/**
 * Instala el bloqueo total de WebSockets en `page` vía `page.routeWebSocket`
 * — la API dedicada de Playwright para el handshake `ws(s)://`
 * (`playwright-core/types/types.d.ts`, pineado en 1.61.1:
 * `routeWebSocket(url: string|RegExp|URLPattern|((url: URL) => boolean),
 * handler: (websocketroute: WebSocketRoute) => Promise<any>|any):
 * Promise<void>`). `page.route()` (el gate de arriba) NO ve este handshake:
 * sin este segundo gate, un `new WebSocket(...)` hacia un host externo lo
 * esquivaría por completo y rompería el req. 14 (cero egress) — hallazgo del
 * review PF-F8 T6.
 *
 * Política: la app hoy NO usa WebSockets, así que en vez de reimplementar el
 * allowlist de origin para un caso que no existe, la opción simple y segura
 * es bloquear TODOS sin excepción — no se evalúa host ni origin del intento.
 * El día que la app necesite un WebSocket legítimo, este gate es lo primero
 * que hay que revisar (y entonces sí justifica una allowlist real, igual que
 * `decideRequest`).
 *
 * Cada intento se cierra con `ws.close()` — nunca se llama
 * `connectToServer()`, así el mock ni siquiera abre el socket real contra el
 * host externo: cero bytes salen. El intento se reporta a `onBlocked` para
 * que el caller lo registre en el MISMO canal que los requests HTTP
 * bloqueados (`NetworkCollector.requestFailures`, que alimenta QA-TE-003) —
 * a diferencia del `route.abort()` de arriba, que dispara `requestfailed` en
 * la page automáticamente, cerrar un `WebSocketRoute` NO dispara
 * `requestfailed`/`response`: no hay wiring automático, el caller debe
 * invocar `onBlocked` explícitamente (ver `run-job.ts`).
 *
 * Debe instalarse ANTES de `page.goto` — Playwright solo rutea WebSockets
 * abiertos DESPUÉS de esta llamada (mismo requisito que documenta
 * `page.routeWebSocket`).
 */
export async function installWebSocketBlock(
  page: Page,
  onBlocked?: (event: BlockedRequestEvent) => void
): Promise<void> {
  await page.routeWebSocket(/.*/, (ws: WebSocketRoute) => {
    onBlocked?.(describeBlockedWebSocket(ws.url()));
    ws.close().catch(() => {});
  });
}
