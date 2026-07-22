/**
 * Checks visuales (QA-VI-001..007) + tipográfico (QA-DI-007) — T6. Todas las
 * tolerancias vienen de `qa/catalog.ts` (nunca hardcodeadas acá). Cada check
 * es un `page.evaluate` que devuelve datos crudos serializables — la
 * construcción de `QaFindingInput` (vía `buildNavFinding`) ocurre en Node,
 * fuera del browser.
 */
import type { Page } from "playwright";
import {
  OVERFLOW_TOLERANCE_PX,
  CLIPPING_TOLERANCE_PX,
  BOUNDING_TOLERANCE_PX,
  ASPECT_RATIO_TOLERANCE,
  type QaFindingInput,
} from "@/lib/pixelforge/qa/catalog";
import { buildNavFinding } from "../finding";

/** QA-VI-001 — overflow horizontal del documento completo. */
export async function checkDocumentOverflow(page: Page, viewport: string): Promise<QaFindingInput[]> {
  const overflow = await page.evaluate(
    (tol) => document.documentElement.scrollWidth > window.innerWidth + tol,
    OVERFLOW_TOLERANCE_PX
  );
  if (!overflow) return [];
  return [
    buildNavFinding("QA-VI-001", {
      description: `El documento tiene overflow horizontal en ${viewport} (scrollWidth > innerWidth + ${OVERFLOW_TOLERANCE_PX}px).`,
      location: { viewport },
    }),
  ];
}

/** QA-VI-002 — overflow horizontal dentro de una sección `[data-pf-node]`. */
export async function checkSectionOverflow(page: Page, viewport: string): Promise<QaFindingInput[]> {
  const nodeIds = await page.evaluate((tol) => {
    return Array.from(document.querySelectorAll<HTMLElement>("[data-pf-node]"))
      .filter((el) => el.scrollWidth > el.clientWidth + tol)
      .map((el) => el.getAttribute("data-pf-node"));
  }, OVERFLOW_TOLERANCE_PX);

  return nodeIds
    .filter((nodeId): nodeId is string => nodeId !== null)
    .map((nodeId) =>
      buildNavFinding("QA-VI-002", {
        description: `Overflow horizontal dentro de la sección "${nodeId}" en ${viewport}.`,
        location: { viewport, nodeId },
      })
    );
}

/** QA-VI-003 — texto truncado inesperadamente (overflow oculto/ellipsis con contenido cortado). */
export async function checkTruncatedText(page: Page, viewport: string): Promise<QaFindingInput[]> {
  const hits = await page.evaluate((tol) => {
    const out: { nodeId: string | null; tag: string }[] = [];
    const candidates = Array.from(document.querySelectorAll<HTMLElement>("[data-pf-node] *"));
    for (const el of candidates) {
      if (!el.textContent || el.textContent.trim().length === 0) continue;
      const cs = getComputedStyle(el);
      const clipped = cs.overflowY === "hidden" || cs.overflow === "hidden" || cs.textOverflow === "ellipsis";
      if (clipped && el.scrollHeight > el.clientHeight + tol) {
        out.push({ nodeId: el.closest("[data-pf-node]")?.getAttribute("data-pf-node") ?? null, tag: el.tagName });
      }
    }
    return out;
  }, CLIPPING_TOLERANCE_PX);

  return hits.map((hit) =>
    buildNavFinding("QA-VI-003", {
      description: `Texto truncado inesperadamente en ${viewport} (elemento <${hit.tag.toLowerCase()}>, sección "${hit.nodeId ?? "?"}").`,
      location: { viewport, nodeId: hit.nodeId ?? undefined },
    })
  );
}

/** QA-VI-004 — bounding box de los hijos directos de cada `[data-pf-node]` fuera del viewport. */
export async function checkBoundingBoxOverflow(page: Page, viewport: string): Promise<QaFindingInput[]> {
  const hits = await page.evaluate((tol) => {
    const out: { nodeId: string; tag: string; left: number; right: number }[] = [];
    for (const node of Array.from(document.querySelectorAll<HTMLElement>("[data-pf-node]"))) {
      const nodeId = node.getAttribute("data-pf-node")!;
      for (const child of Array.from(node.children)) {
        const rect = child.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) continue; // elemento sin layout (display:none) — no aplica.
        if (rect.right > window.innerWidth + tol || rect.left < -tol) {
          out.push({ nodeId, tag: child.tagName, left: rect.left, right: rect.right });
        }
      }
    }
    return out;
  }, BOUNDING_TOLERANCE_PX);

  return hits.map((hit) =>
    buildNavFinding("QA-VI-004", {
      description: `Bounding box fuera de tolerancia en ${viewport} (sección "${hit.nodeId}", <${hit.tag.toLowerCase()}>, left=${Math.round(hit.left)} right=${Math.round(hit.right)}).`,
      location: { viewport, nodeId: hit.nodeId },
    })
  );
}

/** QA-VI-005 — imagen rota (`img.complete && naturalWidth === 0`). */
export async function checkBrokenImages(page: Page, viewport: string): Promise<QaFindingInput[]> {
  const hits = await page.evaluate(() =>
    Array.from(document.querySelectorAll("img"))
      .filter((img) => img.complete && img.naturalWidth === 0)
      .map((img) => ({
        nodeId: img.closest("[data-pf-node]")?.getAttribute("data-pf-node") ?? null,
        src: img.currentSrc || img.src,
      }))
  );

  return hits.map((hit) =>
    buildNavFinding("QA-VI-005", {
      description: `Imagen rota en ${viewport}: ${hit.src}`,
      location: { viewport, nodeId: hit.nodeId ?? undefined },
      evidence: { src: hit.src },
    })
  );
}

/** QA-VI-006 — imagen sin object-fit protector con desvío de aspect ratio > tolerancia. */
export async function checkDistortedImages(page: Page, viewport: string): Promise<QaFindingInput[]> {
  const hits = await page.evaluate((tol) => {
    const out: { nodeId: string | null; src: string; deviation: number }[] = [];
    for (const img of Array.from(document.querySelectorAll("img"))) {
      if (!(img.complete && img.naturalWidth > 0 && img.naturalHeight > 0)) continue;
      const cs = getComputedStyle(img);
      // object-fit "cover"/"contain"/"scale-down" protege el ratio deliberadamente — solo interesa "fill" (default) o "none".
      if (cs.objectFit === "cover" || cs.objectFit === "contain" || cs.objectFit === "scale-down") continue;
      const rect = img.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const naturalRatio = img.naturalWidth / img.naturalHeight;
      const renderedRatio = rect.width / rect.height;
      const deviation = Math.abs(renderedRatio - naturalRatio) / naturalRatio;
      if (deviation > tol) {
        out.push({ nodeId: img.closest("[data-pf-node]")?.getAttribute("data-pf-node") ?? null, src: img.currentSrc || img.src, deviation });
      }
    }
    return out;
  }, ASPECT_RATIO_TOLERANCE);

  return hits.map((hit) =>
    buildNavFinding("QA-VI-006", {
      description: `Imagen distorsionada en ${viewport} (desvío ${(hit.deviation * 100).toFixed(1)}%): ${hit.src}`,
      location: { viewport, nodeId: hit.nodeId ?? undefined },
      evidence: { src: hit.src, deviation: hit.deviation },
    })
  );
}

/** QA-VI-007 — sección visualmente colapsada (`clientHeight < 40`). */
export async function checkCollapsedSections(page: Page, viewport: string): Promise<QaFindingInput[]> {
  const nodeIds = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>("[data-pf-node]"))
      .filter((el) => el.clientHeight < 40)
      .map((el) => el.getAttribute("data-pf-node"))
  );

  return nodeIds
    .filter((nodeId): nodeId is string => nodeId !== null)
    .map((nodeId) =>
      buildNavFinding("QA-VI-007", {
        description: `Sección "${nodeId}" visualmente colapsada en ${viewport} (altura < 40px).`,
        location: { viewport, nodeId },
      })
    );
}

/** QA-DI-007 — jerarquía tipográfica: fontSize h1 > h2 > body; exactamente un h1. */
export async function checkTypographicHierarchy(page: Page, viewport: string): Promise<QaFindingInput[]> {
  const result = await page.evaluate(() => {
    const h1Sizes = Array.from(document.querySelectorAll("h1")).map((el) => parseFloat(getComputedStyle(el).fontSize));
    const h2Sizes = Array.from(document.querySelectorAll("h2")).map((el) => parseFloat(getComputedStyle(el).fontSize));
    const bodyFontSize = parseFloat(getComputedStyle(document.body).fontSize);
    return { h1Count: h1Sizes.length, h1Sizes, h2Sizes, bodyFontSize };
  });

  const problems: string[] = [];
  if (result.h1Count !== 1) problems.push(`hay ${result.h1Count} h1 (debería haber exactamente 1)`);
  const minH1 = result.h1Sizes.length > 0 ? Math.min(...result.h1Sizes) : null;
  const maxH2 = result.h2Sizes.length > 0 ? Math.max(...result.h2Sizes) : null;
  if (minH1 !== null && maxH2 !== null && minH1 <= maxH2) {
    problems.push(`algún h1 (${minH1}px) no es mayor que algún h2 (${maxH2}px)`);
  }
  const minH2 = result.h2Sizes.length > 0 ? Math.min(...result.h2Sizes) : null;
  if (minH2 !== null && minH2 <= result.bodyFontSize) {
    problems.push(`algún h2 (${minH2}px) no es mayor que el body (${result.bodyFontSize}px)`);
  }

  if (problems.length === 0) return [];
  return [
    buildNavFinding("QA-DI-007", {
      description: `Jerarquía tipográfica inconsistente en ${viewport}: ${problems.join("; ")}.`,
      location: { viewport },
      evidence: result,
    }),
  ];
}
