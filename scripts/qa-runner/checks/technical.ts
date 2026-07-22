/**
 * Checks técnicos (QA-TE-001..006/008, T6) — consumen el `NetworkCollector`
 * (`collectors.ts`, ya enganchado ANTES de navegar) más un par de
 * `page.evaluate` puntuales (anclas/hrefs, LCP). QA-TE-007 (sin-JS) vive en
 * `no-js.ts` — necesita su propio contexto sin JavaScript.
 *
 * Reconciliación de nombres de presupuesto (T6, contra el brief): el brief
 * describe QA-TE-006 como "transferencia total > 3MB, o una imagen > 800KB",
 * pero las constantes REALES del catálogo (`qa/catalog.ts`, única fuente de
 * verdad de tolerancias) documentan lo contrario: `IMAGE_ASSET_SIZE_BUDGET_BYTES`
 * (3MB) es el presupuesto de TODAS las imágenes sumadas, y `JS_SIZE_BUDGET_BYTES`
 * (800KB) es el de JavaScript sumado — no de "una imagen suelta". Este
 * módulo sigue el catálogo (fuente de verdad), no la paráfrasis del brief.
 */
import type { Page } from "playwright";
import {
  LCP_BUDGET_MS,
  IMAGE_ASSET_SIZE_BUDGET_BYTES,
  JS_SIZE_BUDGET_BYTES,
  type QaFindingInput,
} from "@/lib/pixelforge/qa/catalog";
import { buildNavFinding } from "../finding";
import { hashSelector } from "../selector-hash";
import type { NetworkCollector } from "../collectors";

/** Patrones de mismatch de hidratación (React/Next 15) — QA-TE-002, critical/bloqueante. */
const HYDRATION_ERROR_PATTERNS: RegExp[] = [
  /hydration failed/i,
  /did not match/i,
  /text content does not match server-rendered html/i,
  /error while hydrating/i,
  /hydration completed but contains mismatches/i,
];

/**
 * Ruido de consola conocido/benigno — QA-TE-004 lo descuenta. Documentado
 * acá (constante única) en vez de silenciar console.error dentro de los
 * componentes.
 */
const CONSOLE_NOISE_ALLOWLIST: RegExp[] = [
  /download the react devtools/i,
  /\[fast refresh\]/i,
];

function isHydrationError(message: string): boolean {
  return HYDRATION_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

function isNoise(message: string): boolean {
  return CONSOLE_NOISE_ALLOWLIST.some((pattern) => pattern.test(message));
}

/** QA-TE-001 (pageerror) + QA-TE-002 (hydration, critical) — se separan del resto de console.error de QA-TE-004. */
export function checkPageErrorsAndHydration(collector: NetworkCollector, viewport: string): QaFindingInput[] {
  const findings: QaFindingInput[] = [];

  for (const message of collector.pageErrors) {
    findings.push(
      buildNavFinding("QA-TE-001", {
        description: `Error de runtime durante la carga/interacción (${viewport}): ${message}`,
        location: { viewport, selectorHash: hashSelector(message) },
        evidence: { message },
      })
    );
  }

  for (const message of [...collector.pageErrors, ...collector.consoleErrors]) {
    if (isHydrationError(message)) {
      findings.push(
        buildNavFinding("QA-TE-002", {
          description: `Mismatch de hidratación detectado en consola (${viewport}): ${message}`,
          location: { viewport, selectorHash: hashSelector(message) },
          evidence: { message },
        })
      );
    }
  }

  return findings;
}

/** QA-TE-003 — recurso que no cargó (same-origin: major; externo: minor). QA-TE-004 — console.error restante, ruido descontado. */
export function checkResourceFailuresAndConsoleNoise(
  collector: NetworkCollector,
  viewport: string
): QaFindingInput[] {
  const findings: QaFindingInput[] = [];

  for (const failure of collector.requestFailures) {
    findings.push(
      buildNavFinding("QA-TE-003", {
        description: `Recurso no cargó (${viewport}, ${failure.sameOrigin ? "same-origin" : "externo"}): ${failure.url} — ${failure.detail}`,
        location: { viewport, selectorHash: hashSelector(failure.url) },
        evidence: { url: failure.url, detail: failure.detail, sameOrigin: failure.sameOrigin },
        severityOverride: failure.sameOrigin ? "major" : "minor",
      })
    );
  }

  for (const message of collector.consoleErrors) {
    if (isHydrationError(message) || isNoise(message)) continue;
    findings.push(
      buildNavFinding("QA-TE-004", {
        description: `console.error durante la carga (${viewport}): ${message}`,
        location: { viewport, selectorHash: hashSelector(message) },
        evidence: { message },
      })
    );
  }

  return findings;
}

/** QA-TE-005 — anclas `#id` deben resolver; hrefs internos bien formados; externos listados (info). */
export async function checkLinksAndAnchors(page: Page, viewport: string): Promise<QaFindingInput[]> {
  const result = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"));
    const broken: string[] = [];
    const external: string[] = [];
    const internalHrefRe = /^\/[a-zA-Z0-9\-_./?=&%#]*$/;
    for (const a of anchors) {
      const href = a.getAttribute("href") ?? "";
      if (href.startsWith("#")) {
        const id = href.slice(1);
        if (id.length > 0 && !document.getElementById(id)) broken.push(href);
      } else if (href.startsWith("/")) {
        if (!internalHrefRe.test(href)) broken.push(href);
      } else if (href.startsWith("https://")) {
        external.push(href);
      }
    }
    return { broken, external };
  });

  const findings: QaFindingInput[] = [];
  for (const href of result.broken) {
    findings.push(
      buildNavFinding("QA-TE-005", {
        description: `Link interno mal formado o ancla que no resuelve (${viewport}): "${href}"`,
        location: { viewport, selectorHash: hashSelector(href) },
        evidence: { href },
      })
    );
  }
  if (result.external.length > 0) {
    findings.push(
      buildNavFinding("QA-TE-005", {
        description: `${result.external.length} link(s) externo(s) detectados (${viewport}) — solo informativo, no se navegan.`,
        location: { viewport, slot: "external-links" },
        evidence: { externalHrefs: result.external },
        severityOverride: "info",
      })
    );
  }
  return findings;
}

/** QA-TE-006 — LCP > presupuesto en móvil; peso total de imágenes/JS > presupuesto (catálogo). */
export async function checkPerformanceBudget(
  page: Page,
  collector: NetworkCollector,
  viewport: string
): Promise<QaFindingInput[]> {
  const findings: QaFindingInput[] = [];

  if (viewport === "mobile") {
    const lcp = await page
      .evaluate(
        () =>
          new Promise<number>((resolve) => {
            let value = 0;
            try {
              const observer = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                const last = entries[entries.length - 1] as PerformanceEntry | undefined;
                if (last) value = last.startTime;
              });
              observer.observe({ type: "largest-contentful-paint", buffered: true } as PerformanceObserverInit);
              setTimeout(() => resolve(value), 100);
            } catch {
              resolve(0);
            }
          })
      )
      .catch(() => 0);

    if (lcp > LCP_BUDGET_MS) {
      findings.push(
        buildNavFinding("QA-TE-006", {
          description: `LCP en móvil (${Math.round(lcp)}ms) excede el presupuesto de ${LCP_BUDGET_MS}ms.`,
          location: { viewport, slot: "lcp" },
          evidence: { lcpMs: lcp, budgetMs: LCP_BUDGET_MS },
        })
      );
    }
  }

  if (collector.imageBytes > IMAGE_ASSET_SIZE_BUDGET_BYTES) {
    findings.push(
      buildNavFinding("QA-TE-006", {
        description: `Peso total de imágenes (${collector.imageBytes} bytes, ${viewport}) excede el presupuesto de ${IMAGE_ASSET_SIZE_BUDGET_BYTES} bytes.`,
        location: { viewport, slot: "image-weight" },
        evidence: { totalBytes: collector.imageBytes, budgetBytes: IMAGE_ASSET_SIZE_BUDGET_BYTES },
      })
    );
  }

  if (collector.jsBytes > JS_SIZE_BUDGET_BYTES) {
    findings.push(
      buildNavFinding("QA-TE-006", {
        description: `Peso total de JavaScript (${collector.jsBytes} bytes, ${viewport}) excede el presupuesto de ${JS_SIZE_BUDGET_BYTES} bytes.`,
        location: { viewport, slot: "js-weight" },
        evidence: { totalBytes: collector.jsBytes, budgetBytes: JS_SIZE_BUDGET_BYTES },
      })
    );
  }

  return findings;
}

/** QA-TE-008 (info) — CSP `frame-ancestors 'self'` presente en la respuesta del preview. */
export function checkCspHeader(headers: Record<string, string>, viewport: string): QaFindingInput[] {
  const csp = headers["content-security-policy"] ?? "";
  const hasFrameAncestorsSelf = /frame-ancestors[^;]*'self'/i.test(csp);
  if (hasFrameAncestorsSelf) return [];
  return [
    buildNavFinding("QA-TE-008", {
      description: `El header Content-Security-Policy del preview no trae frame-ancestors 'self' (${viewport}). Header recibido: "${csp || "(ausente)"}".`,
      location: { viewport, slot: "csp" },
      evidence: { csp },
    }),
  ];
}
