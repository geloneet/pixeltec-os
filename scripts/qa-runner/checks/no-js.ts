/**
 * Pasada sin-JS (QA-TE-007, QA-CA-002, T6) — corre contra una `Page` cuyo
 * `BrowserContext` se creó con `javaScriptEnabled: false` (`index.ts`). En
 * este modo, todos los componentes de F6B/F6C ya garantizan (por diseño,
 * documentado en sus docstrings de hydration-safety) que el SSR deja el
 * contenido completo VISIBLE — este módulo VERIFICA esa garantía desde
 * afuera, no la asume.
 */
import type { Page } from "playwright";
import { CAPABILITY_IDS } from "@/lib/pixelforge/registry/capabilities";
import type { QaFindingInput } from "@/lib/pixelforge/qa/catalog";
import { buildNavFinding } from "../finding";

/** QA-TE-007 — headline/texto de cada `[data-pf-node]` visible sin JavaScript. */
export async function checkNoJsContent(page: Page, viewport: string): Promise<QaFindingInput[]> {
  const hits = await page.evaluate(() => {
    const out: string[] = [];
    for (const node of Array.from(document.querySelectorAll<HTMLElement>("[data-pf-node]"))) {
      const nodeId = node.getAttribute("data-pf-node")!;
      const text = node.textContent?.trim() ?? "";
      const rect = node.getBoundingClientRect();
      const visible = rect.width > 0 && rect.height > 0;
      if (text.length === 0 || !visible) out.push(nodeId);
    }
    return out;
  });

  return hits.map((nodeId) =>
    buildNavFinding("QA-TE-007", {
      description: `La sección "${nodeId}" no muestra contenido/texto sin JavaScript en ${viewport}.`,
      location: { viewport, nodeId },
    })
  );
}

/** QA-CA-002 — el texto clave de cada capability sigue presente y visible sin JavaScript. */
export async function checkNoJsCapabilities(page: Page, viewport: string): Promise<QaFindingInput[]> {
  const hits = await page.evaluate((capabilityIds) => {
    const out: { nodeId: string; componentId: string }[] = [];
    for (const node of Array.from(document.querySelectorAll<HTMLElement>("[data-pf-node][data-pf-component]"))) {
      const componentId = node.getAttribute("data-pf-component")!;
      if (!capabilityIds.includes(componentId)) continue;
      const nodeId = node.getAttribute("data-pf-node")!;
      const text = node.textContent?.trim() ?? "";
      const rect = node.getBoundingClientRect();
      const visible = rect.width > 0 && rect.height > 0;
      if (text.length < 10 || !visible) out.push({ nodeId, componentId });
    }
    return out;
  }, CAPABILITY_IDS as string[]);

  return hits.map((hit) =>
    buildNavFinding("QA-CA-002", {
      description: `La capability "${hit.componentId}" (sección "${hit.nodeId}") no degrada correctamente sin JavaScript en ${viewport} — sin contenido visible.`,
      location: { viewport, nodeId: hit.nodeId, slot: hit.componentId },
    })
  );
}
