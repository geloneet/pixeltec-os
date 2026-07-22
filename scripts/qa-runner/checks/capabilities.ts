/**
 * Checks de capabilities con JS activo (QA-CA-003/004, T6) — QA-CA-002 (pasada
 * sin-JS) vive en `no-js.ts`. Recorre cada `[data-pf-node][data-pf-component]`
 * cuyo `componentId` sea una capability certificada (`CAPABILITY_IDS`,
 * registry) y ejecuta la interacción/gesto de teclado correspondiente
 * (`capability-interactions.ts`). Un `componentId` certificado sin entrada en
 * los mapas de interacción (no debería pasar — paridad la garantiza
 * `capabilities.test.tsx`) se reporta como fallo en vez de silenciarse.
 */
import type { Page } from "playwright";
import { CAPABILITY_IDS } from "@/lib/pixelforge/registry/capabilities";
import type { QaFindingInput } from "@/lib/pixelforge/qa/catalog";
import { buildNavFinding } from "../finding";
import { CAPABILITY_QA_INTERACTIONS, CAPABILITY_QA_KEYBOARD_INTERACTIONS } from "../capability-interactions";

async function capabilityNodes(page: Page): Promise<{ nodeId: string; componentId: string }[]> {
  return page.evaluate((ids) => {
    return Array.from(document.querySelectorAll("[data-pf-node][data-pf-component]"))
      .map((el) => ({
        nodeId: el.getAttribute("data-pf-node")!,
        componentId: el.getAttribute("data-pf-component")!,
      }))
      .filter((entry) => ids.includes(entry.componentId));
  }, CAPABILITY_IDS as string[]);
}

/** QA-CA-003 — interacción principal por click/check. */
export async function checkCapabilityInteractions(page: Page, viewport: string): Promise<QaFindingInput[]> {
  const findings: QaFindingInput[] = [];
  for (const { nodeId, componentId } of await capabilityNodes(page)) {
    const interaction = CAPABILITY_QA_INTERACTIONS[componentId];
    const nodeSelector = `[data-pf-node="${nodeId}"]`;
    if (!interaction) {
      findings.push(
        buildNavFinding("QA-CA-003", {
          description: `La capability "${componentId}" (sección "${nodeId}") no tiene interacción scripted registrada en el runner (desalineación con el registry).`,
          location: { viewport, nodeId, slot: componentId },
        })
      );
      continue;
    }
    const result = await interaction(page, nodeSelector).catch((err) => ({
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    }));
    if (!result.ok) {
      findings.push(
        buildNavFinding("QA-CA-003", {
          description: `La interacción principal de "${componentId}" (sección "${nodeId}") no funcionó en ${viewport}: ${result.detail}`,
          location: { viewport, nodeId, slot: componentId },
          evidence: result,
        })
      );
    }
  }
  return findings;
}

/** QA-CA-004 — operable por teclado: Tab real hasta el control + Enter/Espacio con el mismo efecto que el click. */
export async function checkCapabilityKeyboard(page: Page, viewport: string): Promise<QaFindingInput[]> {
  const findings: QaFindingInput[] = [];
  for (const { nodeId, componentId } of await capabilityNodes(page)) {
    const interaction = CAPABILITY_QA_KEYBOARD_INTERACTIONS[componentId];
    const nodeSelector = `[data-pf-node="${nodeId}"]`;
    if (!interaction) {
      findings.push(
        buildNavFinding("QA-CA-004", {
          description: `La capability "${componentId}" (sección "${nodeId}") no tiene gesto de teclado registrado en el runner (desalineación con el registry).`,
          location: { viewport, nodeId, slot: componentId },
        })
      );
      continue;
    }
    // Reinicia el foco al body antes de cada capability, para que
    // `tabUntilFocused` cuente Tabs desde un punto conocido.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    const result = await interaction(page, nodeSelector).catch((err) => ({
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    }));
    if (!result.ok) {
      findings.push(
        buildNavFinding("QA-CA-004", {
          description: `"${componentId}" (sección "${nodeId}") no es operable por teclado en ${viewport}: ${result.detail}`,
          location: { viewport, nodeId, slot: componentId },
          evidence: result,
        })
      );
    }
  }
  return findings;
}
