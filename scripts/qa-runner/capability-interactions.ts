/**
 * Interacciones scripted por capability (QA-CA-003/004, T6) — un módulo por
 * capability certificada (`CapabilityId`, `@/lib/pixelforge/registry/capabilities`),
 * ESTUDIADO contra la implementación CLIENT real en
 * `src/components/pixelforge/render/capabilities/*.tsx`:
 *
 *  - `product-selector-v1`: cambia un radio de filtro → el conteo
 *    `aria-live="polite"` debe reaccionar (`ProductSelector.tsx`). Sin
 *    filtros derivables el componente degrada a un grid estático sin
 *    fieldsets (D2) — se documenta como "sin interacción que probar", no
 *    como fallo.
 *  - `comparison-table-v1`: cada `<th>` trae un botón "Resaltar" con
 *    `aria-pressed` — clickearlo/activarlo debe alternar el atributo
 *    (`ComparisonTable.tsx`).
 *  - `process-visualizer-v1`: patrón ARIA tabs — activar el segundo tab debe
 *    dejarlo `aria-selected="true"` (`ProcessVisualizer.tsx`).
 *  - `coverage-map-v1`: el buscador por CP anuncia el resultado en
 *    `role="status"` — solo existe si `buscadorPorCP` Y alguna zona trae
 *    `codigosPostales` (D2); si no existe, se documenta como estático por
 *    diseño, no como fallo.
 *
 * QA-CA-003 activa por CLICK; QA-CA-004 activa por TECLADO — Tab real
 * (`tabUntilFocused`) hasta enfocar el control, luego Enter/Espacio. Ambas
 * comparten los mismos "observadores" (antes/después) para no duplicar el
 * criterio de éxito entre el gesto de mouse y el de teclado.
 */
import type { Locator, Page } from "playwright";

export interface InteractionResult {
  ok: boolean;
  detail: string;
}

export type CapabilityInteraction = (page: Page, nodeSelector: string) => Promise<InteractionResult>;

async function textOf(locator: Locator): Promise<string | null> {
  if ((await locator.count()) === 0) return null;
  return (await locator.first().textContent())?.trim() ?? "";
}

/**
 * Tab real (sin `.focus()` programático) hasta que `document.activeElement`
 * coincida con `targetSelector`, o `maxTabs` intentos agotados. Devuelve
 * `true` si se alcanzó — la barrera real de "operable por teclado" (CA-004)
 * es que el foco LLEGUE ahí navegando, no que el elemento sea focuseable en
 * abstracto.
 */
export async function tabUntilFocused(page: Page, targetSelector: string, maxTabs = 60): Promise<boolean> {
  for (let i = 0; i < maxTabs; i++) {
    await page.keyboard.press("Tab");
    const reached = await page.evaluate((sel) => {
      const target = document.querySelector(sel);
      return target !== null && document.activeElement === target;
    }, targetSelector);
    if (reached) return true;
  }
  return false;
}

// ─── QA-CA-003 — activación por click/check ────────────────────────────────

export const CAPABILITY_QA_INTERACTIONS: Record<string, CapabilityInteraction> = {
  "product-selector-v1": async (page, nodeSelector) => {
    const radio = page.locator(`${nodeSelector} input[type="radio"]`).first();
    if ((await radio.count()) === 0) {
      return { ok: true, detail: "sin filtros derivables (grid estático, D2) — presencia OK, sin interacción que probar" };
    }
    const live = page.locator(`${nodeSelector} [aria-live="polite"]`);
    const before = await textOf(live);
    await radio.check({ force: true });
    await page.waitForTimeout(150);
    const after = await textOf(live);
    return before !== after
      ? { ok: true, detail: "el conteo aria-live reaccionó al cambiar el filtro" }
      : { ok: false, detail: `el conteo aria-live no cambió al seleccionar un radio (antes="${before}", después="${after}")` };
  },

  "comparison-table-v1": async (page, nodeSelector) => {
    const button = page.locator(`${nodeSelector} thead button`).first();
    if ((await button.count()) === 0) return { ok: false, detail: "no se encontró el botón de resaltar columna en thead" };
    const before = await button.getAttribute("aria-pressed");
    await button.click();
    await page.waitForTimeout(150);
    const after = await button.getAttribute("aria-pressed");
    return before !== after
      ? { ok: true, detail: "aria-pressed alternó tras el click de resaltar" }
      : { ok: false, detail: `aria-pressed no cambió (antes=${before}, después=${after})` };
  },

  "process-visualizer-v1": async (page, nodeSelector) => {
    const tabs = page.locator(`${nodeSelector} [role="tab"]`);
    if ((await tabs.count()) < 2) return { ok: true, detail: "menos de 2 pasos — sin tabs que alternar" };
    const second = tabs.nth(1);
    await second.click();
    await page.waitForTimeout(150);
    const selected = await second.getAttribute("aria-selected");
    return selected === "true"
      ? { ok: true, detail: "el segundo tab quedó aria-selected tras el click" }
      : { ok: false, detail: `el segundo tab no quedó seleccionado (aria-selected=${selected})` };
  },

  "coverage-map-v1": async (page, nodeSelector) => {
    const input = page.locator(`${nodeSelector} input[type="text"]`).first();
    if ((await input.count()) === 0) {
      return { ok: true, detail: "sin buscador por CP (componente sin codigosPostales, D2) — presencia OK, estático por diseño" };
    }
    const announce = page.locator(`${nodeSelector} [role="status"]`);
    await input.fill("00000");
    await input.press("Enter");
    await page.waitForTimeout(150);
    const text = await textOf(announce);
    return text && text.length > 0
      ? { ok: true, detail: "el aria-live de resultado de búsqueda se anunció" }
      : { ok: false, detail: "el aria-live de resultado de búsqueda quedó vacío tras buscar" };
  },
};

// ─── QA-CA-004 — activación por teclado (Tab real + Enter/Espacio) ─────────

export const CAPABILITY_QA_KEYBOARD_INTERACTIONS: Record<string, CapabilityInteraction> = {
  "product-selector-v1": async (page, nodeSelector) => {
    const targetSelector = `${nodeSelector} input[type="radio"]`;
    const radio = page.locator(targetSelector).first();
    if ((await radio.count()) === 0) {
      return { ok: true, detail: "sin filtros derivables (grid estático, D2) — presencia OK, sin interacción que probar" };
    }
    const reached = await tabUntilFocused(page, targetSelector);
    if (!reached) return { ok: false, detail: "Tab nunca alcanzó el primer radio del filtro" };
    const live = page.locator(`${nodeSelector} [aria-live="polite"]`);
    const before = await textOf(live);
    await page.keyboard.press("Space"); // radio nativo: Espacio lo marca.
    await page.waitForTimeout(150);
    const after = await textOf(live);
    return before !== after
      ? { ok: true, detail: "Tab+Espacio alcanzó el radio y el aria-live reaccionó" }
      : { ok: false, detail: `Tab+Espacio no cambió el aria-live (antes="${before}", después="${after}")` };
  },

  "comparison-table-v1": async (page, nodeSelector) => {
    const targetSelector = `${nodeSelector} thead button`;
    const button = page.locator(targetSelector).first();
    if ((await button.count()) === 0) return { ok: false, detail: "no se encontró el botón de resaltar columna en thead" };
    const reached = await tabUntilFocused(page, targetSelector);
    if (!reached) return { ok: false, detail: "Tab nunca alcanzó el botón de resaltar" };
    const before = await button.getAttribute("aria-pressed");
    await page.keyboard.press("Enter"); // <button> nativo: Enter dispara click.
    await page.waitForTimeout(150);
    const after = await button.getAttribute("aria-pressed");
    return before !== after
      ? { ok: true, detail: "Tab+Enter alcanzó el botón y aria-pressed alternó" }
      : { ok: false, detail: `Tab+Enter no cambió aria-pressed (antes=${before}, después=${after})` };
  },

  "process-visualizer-v1": async (page, nodeSelector) => {
    const tabs = page.locator(`${nodeSelector} [role="tab"]`);
    if ((await tabs.count()) < 2) return { ok: true, detail: "menos de 2 pasos — sin tabs que alternar" };
    const firstSelector = `${nodeSelector} [role="tab"]`;
    const reached = await tabUntilFocused(page, firstSelector);
    if (!reached) return { ok: false, detail: "Tab nunca alcanzó el primer tab del stepper" };
    await page.keyboard.press("ArrowRight"); // patrón tablist: flechas mueven Y activan (ProcessVisualizer.tsx).
    await page.waitForTimeout(150);
    const second = tabs.nth(1);
    const selected = await second.getAttribute("aria-selected");
    return selected === "true"
      ? { ok: true, detail: "Tab+ArrowRight movió la selección al segundo tab" }
      : { ok: false, detail: `Tab+ArrowRight no seleccionó el segundo tab (aria-selected=${selected})` };
  },

  "coverage-map-v1": async (page, nodeSelector) => {
    const targetSelector = `${nodeSelector} input[type="text"]`;
    const input = page.locator(targetSelector).first();
    if ((await input.count()) === 0) {
      return { ok: true, detail: "sin buscador por CP (componente sin codigosPostales, D2) — presencia OK, estático por diseño" };
    }
    const reached = await tabUntilFocused(page, targetSelector);
    if (!reached) return { ok: false, detail: "Tab nunca alcanzó el input de código postal" };
    const announce = page.locator(`${nodeSelector} [role="status"]`);
    await page.keyboard.type("00000");
    await page.keyboard.press("Enter"); // envía el <form>.
    await page.waitForTimeout(150);
    const text = await textOf(announce);
    return text && text.length > 0
      ? { ok: true, detail: "Tab+teclado hasta el input y Enter anunció el resultado" }
      : { ok: false, detail: "Tab+Enter no dejó ningún anuncio en el aria-live de resultado" };
  },
};
