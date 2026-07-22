/**
 * Screenshots del job (D3 del plan, T6): 3 full-page (una por viewport) +
 * recortes SOLO para findings `major`+ de layout (`QA-VI-*`). Sube a R2 vía
 * `@/lib/r2/upload` (mismo patrón que `pixelforge/visual/storage.ts`) e
 * inserta la fila en `pixelforge_assets` (kind `qa_screenshot`, función
 * aditiva `insertQaScreenshotAsset`, T6). Decisión de dónde referenciar los 3
 * full-page (ver docstring del brief, "elige y documenta"): quedan en
 * `engine.screenshots` (el objeto que arma `finishQaBrowserJob`), NO en cada
 * finding — son evidencia general del job, no de un hallazgo puntual.
 */
import type { Page } from "playwright";
import { uploadObject } from "@/lib/r2/upload";
import { insertQaScreenshotAsset } from "@/lib/db/repos/pixelforge";
import type { QaFindingInput } from "@/lib/pixelforge/qa/catalog";
import { buildQaScreenshotKey } from "./screenshot-key";

export interface ScreenshotContext {
  ownerId: string;
  projectId: string;
  qaRunId: string;
}

export interface FullPageScreenshotRef {
  viewport: string;
  assetId: string;
  url: string;
}

/** Full-page de un viewport ya cargado — sube y registra el asset. */
export async function captureFullPageScreenshot(
  page: Page,
  ctx: ScreenshotContext,
  viewport: string
): Promise<FullPageScreenshotRef> {
  const buffer = await page.screenshot({ fullPage: true, type: "png" });
  const key = buildQaScreenshotKey(ctx.ownerId, ctx.projectId, ctx.qaRunId, `${viewport}-fullpage`);
  const url = await uploadObject(key, buffer, "image/png");
  const assetId = await insertQaScreenshotAsset(ctx.projectId, {
    url,
    r2Key: key,
    contentType: "image/png",
    sizeBytes: buffer.length,
  });
  return { viewport, assetId, url };
}

/**
 * Recorta y sube UN screenshot por finding `QA-VI-*` `major`/`critical` con
 * `location.nodeId` — muta `finding.evidence.screenshotAssetId` in-place.
 * Best-effort: un recorte que falla (elemento fuera de viewport, ya
 * desmontado, etc.) no debe tumbar el job — se descarta en silencio, el
 * finding ya persiste igual sin el crop.
 */
export async function attachCropsForMajorVisualFindings(
  page: Page,
  ctx: ScreenshotContext,
  viewport: string,
  findings: QaFindingInput[]
): Promise<void> {
  for (const finding of findings) {
    if (!finding.checkCode.startsWith("QA-VI-")) continue;
    if (finding.severity !== "major" && finding.severity !== "critical") continue;
    const location = finding.location as { nodeId?: string } | undefined;
    if (!location?.nodeId) continue;

    try {
      const buffer = await page
        .locator(`[data-pf-node="${location.nodeId}"]`)
        .first()
        .screenshot({ type: "png" });
      const key = buildQaScreenshotKey(
        ctx.ownerId,
        ctx.projectId,
        ctx.qaRunId,
        `${viewport}-${finding.checkCode}-${location.nodeId}`
      );
      const url = await uploadObject(key, buffer, "image/png");
      const assetId = await insertQaScreenshotAsset(ctx.projectId, {
        url,
        r2Key: key,
        contentType: "image/png",
        sizeBytes: buffer.length,
      });
      finding.evidence = { ...((finding.evidence as Record<string, unknown>) ?? {}), screenshotAssetId: assetId };
    } catch {
      // best-effort — ver docstring.
    }
  }
}
