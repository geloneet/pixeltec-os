/**
 * Checks de accesibilidad (QA-AX-001..006, T6). QA-AX-001 inyecta axe-core
 * desde el BUNDLE LOCAL de `node_modules` (jamás un CDN — cero egress extra,
 * consistente con el allowlist de `security.ts`) y mapea `impact` → severidad
 * vía `axe-severity.ts` (que a su vez lee `AXE_IMPACT_TO_SEVERITY` del
 * catálogo). Los demás (AX-002..006) son checks manuales — más precisos y
 * con severidad/blocking propios del catálogo — así que sus reglas axe
 * equivalentes se EXCLUYEN del barrido genérico de AX-001 para no reportar
 * el mismo problema 2 veces bajo 2 códigos distintos.
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import type { Page } from "playwright";
import type { QaFindingInput } from "@/lib/pixelforge/qa/catalog";
import { buildNavFinding } from "../finding";
import { severityForAxeImpact } from "../axe-severity";
import { hashSelector } from "../selector-hash";

const require = createRequire(import.meta.url);

/** Reglas de axe-core con check manual dedicado (AX-004/005/006) — se excluyen del barrido AX-001 para no duplicar el hallazgo. */
const EXCLUDED_FROM_AX_001 = new Set(["heading-order", "landmark-one-main", "region", "label"]);

interface AxeViolationNode {
  target: string[];
  html: string;
  failureSummary?: string;
}
interface AxeViolation {
  id: string;
  impact: "critical" | "serious" | "moderate" | "minor" | null;
  help: string;
  description: string;
  nodes: AxeViolationNode[];
}

/** Ruta ABSOLUTA del bundle local de axe-core — nunca una URL externa. */
function axeBundlePath(): string {
  const path = require.resolve("axe-core/axe.min.js");
  if (!existsSync(path)) {
    throw new Error(`qa-runner: no se encontró el bundle local de axe-core en ${path}`);
  }
  return path;
}

/** QA-AX-001 — violaciones de axe-core (bundle local), un finding por regla+nodo. */
export async function checkAxeViolations(page: Page, viewport: string): Promise<QaFindingInput[]> {
  await page.addScriptTag({ path: axeBundlePath() });
  const violations = await page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: () => Promise<{ violations: AxeViolation[] }> } }).axe;
    const result = await axe.run();
    return result.violations;
  });

  const findings: QaFindingInput[] = [];
  for (const violation of violations) {
    if (EXCLUDED_FROM_AX_001.has(violation.id)) continue;
    for (const node of violation.nodes) {
      const selector = node.target.join(" ");
      const nodeId = await page
        .evaluate((sel) => {
          try {
            return document.querySelector(sel)?.closest("[data-pf-node]")?.getAttribute("data-pf-node") ?? null;
          } catch {
            return null;
          }
        }, selector)
        .catch(() => null);

      findings.push(
        buildNavFinding("QA-AX-001", {
          description: `axe-core (${violation.id}, ${viewport}): ${violation.help} — ${selector}`,
          location: { viewport, nodeId: nodeId ?? undefined, selectorHash: hashSelector(`${violation.id}|${selector}`) },
          evidence: { ruleId: violation.id, impact: violation.impact, help: violation.help, html: node.html, failureSummary: node.failureSummary },
          severityOverride: severityForAxeImpact(violation.impact),
        })
      );
    }
  }
  return findings;
}

/** QA-AX-002 (critical/bloqueante) — trampa de foco: Tab N veces sin avanzar realmente. */
export async function checkKeyboardTrap(page: Page, viewport: string): Promise<QaFindingInput[]> {
  const focusableCount = await page.evaluate(() => {
    const selector =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return document.querySelectorAll(selector).length;
  });
  if (focusableCount === 0) return [];

  const attempts = focusableCount * 2 + 5;
  const path: string[] = [];
  for (let i = 0; i < attempts; i++) {
    await page.keyboard.press("Tab");
    const marker = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return "body";
      return el.tagName + "#" + (el.id || "") + "." + (el.getAttribute("data-pf-node") ?? "");
    });
    path.push(marker);
  }

  // "el foco cicla sin avanzar" = mismo pequeño ciclo repitiéndose sin
  // alcanzar variedad razonable: si en TODO el recorrido no aparecieron al
  // menos la mitad de los elementos focuseables distintos, hay trampa real
  // (un ciclo de 1-2 elementos repitiéndose para siempre).
  const distinct = new Set(path).size;
  if (distinct < Math.max(2, Math.ceil(focusableCount / 2))) {
    return [
      buildNavFinding("QA-AX-002", {
        description: `Trampa de foco de teclado en ${viewport}: tras ${attempts} Tabs solo se visitaron ${distinct} elementos distintos de ~${focusableCount} focuseables.`,
        location: { viewport },
        evidence: { focusableCount, attempts, distinct },
      }),
    ];
  }
  return [];
}

/** QA-AX-003 — foco visible: outline o box-shadow distinto entre focus y blur. */
export async function checkFocusVisible(page: Page, viewport: string): Promise<QaFindingInput[]> {
  const hits = await page.evaluate(async () => {
    const focusables = Array.from(
      document.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).slice(0, 40); // tope defensivo — landings de 3-14 nodos no deberían acercarse a este límite.
    const out: { nodeId: string | null; tag: string }[] = [];
    for (const el of focusables) {
      const blurredStyle = getComputedStyle(el);
      const blurredSignature = `${blurredStyle.outlineStyle}|${blurredStyle.outlineWidth}|${blurredStyle.boxShadow}`;
      el.focus();
      const focusedStyle = getComputedStyle(el);
      const focusedSignature = `${focusedStyle.outlineStyle}|${focusedStyle.outlineWidth}|${focusedStyle.boxShadow}`;
      el.blur();
      if (blurredSignature === focusedSignature) {
        out.push({ nodeId: el.closest("[data-pf-node]")?.getAttribute("data-pf-node") ?? null, tag: el.tagName });
      }
    }
    return out;
  });

  return hits.map((hit) =>
    buildNavFinding("QA-AX-003", {
      description: `Foco no visible en ${viewport} (<${hit.tag.toLowerCase()}>, sección "${hit.nodeId ?? "?"}") — outline/box-shadow no cambian entre blur y focus.`,
      location: { viewport, nodeId: hit.nodeId ?? undefined },
    })
  );
}

/** QA-AX-004 — landmarks: existe main, existe footer/contentinfo, un solo h1. */
export async function checkLandmarks(page: Page, viewport: string): Promise<QaFindingInput[]> {
  const result = await page.evaluate(() => ({
    hasMain: document.querySelectorAll('main, [role="main"]').length,
    hasFooter: document.querySelectorAll('footer, [role="contentinfo"]').length,
    h1Count: document.querySelectorAll("h1").length,
  }));

  const problems: string[] = [];
  if (result.hasMain !== 1) problems.push(`main: ${result.hasMain} (esperado 1)`);
  if (result.hasFooter !== 1) problems.push(`footer/contentinfo: ${result.hasFooter} (esperado 1)`);
  if (result.h1Count !== 1) problems.push(`h1: ${result.h1Count} (esperado 1)`);

  if (problems.length === 0) return [];
  return [
    buildNavFinding("QA-AX-004", {
      description: `Landmarks faltantes o duplicados en ${viewport}: ${problems.join("; ")}.`,
      location: { viewport },
      evidence: result,
    }),
  ];
}

/** QA-AX-005 — headings sin saltos de nivel (p.ej. h2 → h4 directo). */
export async function checkHeadingOrder(page: Page, viewport: string): Promise<QaFindingInput[]> {
  const jumps = await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6")).map((el) =>
      Number(el.tagName.slice(1))
    );
    const found: string[] = [];
    for (let i = 1; i < headings.length; i++) {
      if (headings[i] - headings[i - 1] > 1) {
        found.push(`h${headings[i - 1]} → h${headings[i]}`);
      }
    }
    return found;
  });

  if (jumps.length === 0) return [];
  return [
    buildNavFinding("QA-AX-005", {
      description: `Salto(s) de nivel de encabezado en ${viewport}: ${jumps.join(", ")}.`,
      location: { viewport },
      evidence: { jumps },
    }),
  ];
}

/**
 * QA-AX-006 — cualquier `<form>` de la página: inputs con label asociado +
 * submit accesible. Reconciliación con el brief (T6): el brief describe este
 * check como "inputs del footer-contact", pero `FooterContact.tsx` (revisado
 * contra el código real) NO tiene ningún `<form>`/`<input>` — solo
 * tel:/mailto: y links de texto. El único formulario real hoy es el buscador
 * de CP de `CoverageMap.tsx` (capability). El TÍTULO/severidad del catálogo
 * para QA-AX-006 es genérico ("Formulario sin label asociado..."), así que
 * este check generaliza a "cualquier `<form>` de la página" — cubre el caso
 * real existente y cualquier formulario futuro, sin depender de un
 * componente que hoy no tiene ninguno.
 */
export async function checkFormAccessibility(page: Page, viewport: string): Promise<QaFindingInput[]> {
  const problems = await page.evaluate(() => {
    const out: { formIndex: number; issue: string }[] = [];
    const forms = Array.from(document.querySelectorAll("form"));
    forms.forEach((form, formIndex) => {
      const inputs = Array.from(form.querySelectorAll<HTMLElement>("input, select, textarea"));
      for (const input of inputs) {
        const id = input.getAttribute("id");
        const hasLabelFor = id ? document.querySelector(`label[for="${id}"]`) !== null : false;
        const hasWrappingLabel = input.closest("label") !== null;
        const hasAriaLabel = input.hasAttribute("aria-label") || input.hasAttribute("aria-labelledby");
        if (!hasLabelFor && !hasWrappingLabel && !hasAriaLabel) {
          out.push({ formIndex, issue: `input sin label asociado (${input.tagName.toLowerCase()})` });
        }
      }
      const submit = form.querySelector('button[type="submit"], input[type="submit"], button:not([type])');
      if (!submit) out.push({ formIndex, issue: "sin control de submit accesible" });
    });
    return out;
  });

  return problems.map((problem) =>
    buildNavFinding("QA-AX-006", {
      description: `Formulario #${problem.formIndex} en ${viewport}: ${problem.issue}.`,
      location: { viewport, slot: `form-${problem.formIndex}` },
    })
  );
}
