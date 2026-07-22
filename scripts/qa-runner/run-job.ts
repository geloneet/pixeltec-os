/**
 * Orquesta las 3 pasadas de un job de QA de navegador (PF-F8 T6, D del plan)
 * sobre un `Browser` YA lanzado por `index.ts` (que también controla el
 * timeout duro de 4 min y el cierre del browser). Un browser, varios
 * `BrowserContext` (uno por viewport/pasada) — nunca páginas sueltas sin su
 * propio contexto, así el allowlist de egress (`route-guard.ts`) y los
 * listeners (`collectors.ts`) quedan aislados por pasada.
 *
 * Cero egress (req. 14) tiene 3 gates, TODOS instalados/configurados en cada
 * pasada, ninguno opcional: (1) `installEgressAllowlist` sobre HTTP vía
 * `page.route`; (2) `installWebSocketBlock` sobre WebSockets vía
 * `page.routeWebSocket` — `page.route` NO ve el handshake `ws(s)://`
 * (hallazgo de review, PF-F8 T6); (3) `serviceWorkers: 'block'` en CADA
 * `browser.newContext` — un service worker registrado por la página podría
 * seguir haciendo fetch en segundo plano fuera del ciclo de vida de la
 * request normal.
 *
 * Orden dentro del pass de viewport (importa para QA-MO-005, ver
 * `checks/motion.ts`): primero los checks de layout/tipografía (estado
 * "recién cargado", antes de que la animación de entrada del CTA se
 * consuma), LUEGO el check del CTA (dispara su propia entrada + muestrea
 * durante la ventana de animación), LUEGO el scroll-through completo
 * (asienta TODO lo demás) y recién ahí motion/axe/capabilities — en ese
 * orden porque interactuar con las capabilities (clicks/teclado) puede
 * mutar el DOM (aria-pressed, filtros) y conviene que axe evalúe el estado
 * "limpio" antes de esa mutación.
 */
import type { Browser } from "playwright";
import { QA_VIEWPORTS } from "./viewports";
import { installEgressAllowlist, installWebSocketBlock } from "./route-guard";
import { attachNetworkCollector } from "./collectors";
import type { QaFindingInput } from "@/lib/pixelforge/qa/catalog";
import {
  captureFullPageScreenshot,
  attachCropsForMajorVisualFindings,
  type ScreenshotContext,
  type FullPageScreenshotRef,
} from "./screenshots";
import {
  checkDocumentOverflow,
  checkSectionOverflow,
  checkTruncatedText,
  checkBoundingBoxOverflow,
  checkBrokenImages,
  checkDistortedImages,
  checkCollapsedSections,
  checkTypographicHierarchy,
} from "./checks/visual";
import {
  scrollThroughSections,
  checkMotionDeadlock,
  checkReducedMotion,
  checkCountUpSettled,
  checkCtaNotBlocked,
} from "./checks/motion";
import {
  checkAxeViolations,
  checkKeyboardTrap,
  checkFocusVisible,
  checkLandmarks,
  checkHeadingOrder,
  checkFormAccessibility,
} from "./checks/axe";
import { checkCapabilityInteractions, checkCapabilityKeyboard } from "./checks/capabilities";
import { checkLinksAndAnchors, checkPerformanceBudget, checkPageErrorsAndHydration, checkResourceFailuresAndConsoleNoise, checkCspHeader } from "./checks/technical";
import { checkNoJsContent, checkNoJsCapabilities } from "./checks/no-js";

const NAV_TIMEOUT_MS = 30_000;
const INITIAL_SETTLE_MS = 500;
const REDUCED_MOTION_SETTLE_MS = 300;
/** Viewport desktop — reusado por las pasadas reduced-motion y sin-JS (D del plan: ambas corren en desktop). */
const DESKTOP_VIEWPORT = QA_VIEWPORTS.find((v) => v.name === "desktop")!;

export interface RunJobResult {
  findings: QaFindingInput[];
  screenshots: FullPageScreenshotRef[];
}

async function runViewportPass(
  browser: Browser,
  previewUrl: string,
  allowedOrigin: string,
  screenshotCtx: ScreenshotContext,
  viewport: (typeof QA_VIEWPORTS)[number]
): Promise<{ findings: QaFindingInput[]; screenshot: FullPageScreenshotRef }> {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const collector = attachNetworkCollector(page, allowedOrigin);
  await installEgressAllowlist(page, allowedOrigin);
  // `route.abort()` (gate HTTP) dispara `requestfailed` solo automáticamente;
  // cerrar un `WebSocketRoute` no dispara nada en la page, así que el
  // intento bloqueado se registra a mano en el MISMO canal que alimenta
  // QA-TE-003 (`checks/technical.ts`).
  await installWebSocketBlock(page, (event) => {
    collector.requestFailures.push({
      url: event.url,
      sameOrigin: false,
      detail: `WebSocket bloqueado por política de egress (${event.reason})`,
    });
  });

  const response = await page.goto(previewUrl, { waitUntil: "load", timeout: NAV_TIMEOUT_MS });
  await page.waitForTimeout(INITIAL_SETTLE_MS);

  const findings: QaFindingInput[] = [];

  findings.push(...(await checkDocumentOverflow(page, viewport.name)));
  findings.push(...(await checkSectionOverflow(page, viewport.name)));
  findings.push(...(await checkTruncatedText(page, viewport.name)));
  findings.push(...(await checkBoundingBoxOverflow(page, viewport.name)));
  findings.push(...(await checkBrokenImages(page, viewport.name)));
  findings.push(...(await checkDistortedImages(page, viewport.name)));
  findings.push(...(await checkCollapsedSections(page, viewport.name)));
  findings.push(...(await checkTypographicHierarchy(page, viewport.name)));

  // CTA: dispara + muestrea su propia entrada ANTES del scroll-through completo.
  findings.push(...(await checkCtaNotBlocked(page, viewport.name)));

  await scrollThroughSections(page);
  findings.push(...(await checkMotionDeadlock(page, viewport.name)));
  findings.push(...(await checkCountUpSettled(page, viewport.name)));

  findings.push(...(await checkAxeViolations(page, viewport.name)));
  findings.push(...(await checkKeyboardTrap(page, viewport.name)));
  findings.push(...(await checkFocusVisible(page, viewport.name)));
  findings.push(...(await checkLandmarks(page, viewport.name)));
  findings.push(...(await checkHeadingOrder(page, viewport.name)));
  findings.push(...(await checkFormAccessibility(page, viewport.name)));

  findings.push(...(await checkCapabilityInteractions(page, viewport.name)));
  findings.push(...(await checkCapabilityKeyboard(page, viewport.name)));

  findings.push(...(await checkLinksAndAnchors(page, viewport.name)));
  findings.push(...(await checkPerformanceBudget(page, collector, viewport.name)));
  if (response) findings.push(...checkCspHeader(response.headers(), viewport.name));
  findings.push(...checkPageErrorsAndHydration(collector, viewport.name));
  findings.push(...checkResourceFailuresAndConsoleNoise(collector, viewport.name));

  await attachCropsForMajorVisualFindings(page, screenshotCtx, viewport.name, findings);
  const screenshot = await captureFullPageScreenshot(page, screenshotCtx, viewport.name);

  await context.close();
  return { findings, screenshot };
}

async function runReducedMotionPass(
  browser: Browser,
  previewUrl: string,
  allowedOrigin: string
): Promise<QaFindingInput[]> {
  const context = await browser.newContext({
    viewport: { width: DESKTOP_VIEWPORT.width, height: DESKTOP_VIEWPORT.height },
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  await installEgressAllowlist(page, allowedOrigin);
  await installWebSocketBlock(page);
  await page.goto(previewUrl, { waitUntil: "load", timeout: NAV_TIMEOUT_MS });
  await page.waitForTimeout(REDUCED_MOTION_SETTLE_MS);

  // checkReducedMotion hace su propio reload tras emulateMedia (necesita que
  // el SSR inicial ya haya cargado una vez para no confundir "primera carga"
  // con "carga bajo reduced-motion").
  const findings = await checkReducedMotion(page);

  await context.close();
  return findings;
}

async function runNoJsPass(browser: Browser, previewUrl: string, allowedOrigin: string): Promise<QaFindingInput[]> {
  const context = await browser.newContext({
    viewport: { width: DESKTOP_VIEWPORT.width, height: DESKTOP_VIEWPORT.height },
    javaScriptEnabled: false,
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  await installEgressAllowlist(page, allowedOrigin);
  await installWebSocketBlock(page);
  await page.goto(previewUrl, { waitUntil: "load", timeout: NAV_TIMEOUT_MS });

  const findings: QaFindingInput[] = [];
  findings.push(...(await checkNoJsContent(page, "desktop")));
  findings.push(...(await checkNoJsCapabilities(page, "desktop")));

  await context.close();
  return findings;
}

export async function runQaBrowserJob(
  browser: Browser,
  previewUrl: string,
  allowedOrigin: string,
  screenshotCtx: ScreenshotContext
): Promise<RunJobResult> {
  const findings: QaFindingInput[] = [];
  const screenshots: FullPageScreenshotRef[] = [];

  for (const viewport of QA_VIEWPORTS) {
    const result = await runViewportPass(browser, previewUrl, allowedOrigin, screenshotCtx, viewport);
    findings.push(...result.findings);
    screenshots.push(result.screenshot);
  }

  findings.push(...(await runReducedMotionPass(browser, previewUrl, allowedOrigin)));
  findings.push(...(await runNoJsPass(browser, previewUrl, allowedOrigin)));

  return { findings, screenshots };
}
