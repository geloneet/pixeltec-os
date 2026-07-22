/**
 * Checks de motion (QA-MO-001/002/003/005, T6) — contra la superficie DOM de
 * `MotionSection.tsx`: `[data-pf-motion-node]` (wrapper por sección con
 * motion), `[data-pf-motion-item]` (stagger/scroll-steps) y
 * `[data-pf-motion-count]` (count-up, valor objetivo en el propio atributo).
 *
 * QA-MO-001 es el anti-deadlock del bug real F6B (ver docstring de
 * `MotionSection.tsx`: "el elemento observado por useInView JAMÁS recibe
 * estilos de motion — la tween anima `firstElementChild`") — este check NO
 * reimplementa esa lógica, la VERIFICA desde afuera: tras scrollear la
 * página completa con settle, ningún `[data-pf-motion-item]` ni el hijo
 * animado de un `[data-pf-motion-node]` debe quedar oculto para siempre.
 */
import type { Page } from "playwright";
import { MOTION_SETTLE_MS, type QaFindingInput } from "@/lib/pixelforge/qa/catalog";
import { buildNavFinding } from "../finding";
import { countSettledAtTarget } from "../count-target";

/**
 * Scroll paso a paso hasta el fondo con settle de `MOTION_SETTLE_MS` por
 * sección (`[data-pf-node]`) — dispara los triggers `in-view` de TODAS las
 * secciones antes de que los checks de asentamiento (MO-001/003) lean el DOM.
 */
export async function scrollThroughSections(page: Page): Promise<void> {
  const sectionCount = await page.evaluate(() => document.querySelectorAll("[data-pf-node]").length);
  for (let i = 0; i < sectionCount; i++) {
    await page.evaluate((index) => {
      const nodes = document.querySelectorAll("[data-pf-node]");
      nodes[index]?.scrollIntoView({ behavior: "auto", block: "center" });
    }, i);
    await page.waitForTimeout(MOTION_SETTLE_MS);
  }
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(MOTION_SETTLE_MS);
}

/** QA-MO-001 (critical/bloqueante) — nada queda deadlocked tras el settle completo. */
export async function checkMotionDeadlock(page: Page, viewport: string): Promise<QaFindingInput[]> {
  const hits = await page.evaluate(() => {
    const out: { nodeId: string | null; tag: string; opacity: number; hidden: boolean }[] = [];
    const items = Array.from(document.querySelectorAll<HTMLElement>("[data-pf-motion-item]"));
    const motionTargets = Array.from(document.querySelectorAll<HTMLElement>("[data-pf-motion-node]"))
      .map((wrapper) => wrapper.firstElementChild as HTMLElement | null)
      .filter((el): el is HTMLElement => el !== null);
    for (const el of [...items, ...motionTargets]) {
      const cs = getComputedStyle(el);
      const opacity = parseFloat(cs.opacity);
      const hidden = cs.visibility === "hidden";
      const clipHides = cs.clipPath !== "none" && /inset\(\s*100%|circle\(\s*0/.test(cs.clipPath);
      if (opacity < 0.05 || hidden || clipHides) {
        out.push({ nodeId: el.closest("[data-pf-node]")?.getAttribute("data-pf-node") ?? null, tag: el.tagName, opacity, hidden });
      }
    }
    return out;
  });

  return hits.map((hit) =>
    buildNavFinding("QA-MO-001", {
      description: `Deadlock de motion en ${viewport}: <${hit.tag.toLowerCase()}> de la sección "${hit.nodeId ?? "?"}" quedó oculto tras el settle (opacity=${hit.opacity}, visibility-hidden=${hit.hidden}).`,
      location: { viewport, nodeId: hit.nodeId ?? undefined },
    })
  );
}

/** QA-MO-002 — reduced-motion respetado: above-the-fold visible de inmediato, sin transform animándose. */
export async function checkReducedMotion(page: Page): Promise<QaFindingInput[]> {
  const findings: QaFindingInput[] = [];
  const viewport = "desktop";

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(100);

  const sample = async () =>
    page.evaluate(() => {
      const wrappers = Array.from(document.querySelectorAll<HTMLElement>("[data-pf-motion-node]")).filter(
        (el) => el.getBoundingClientRect().top < window.innerHeight
      );
      return wrappers.map((wrapper) => {
        const target = (wrapper.firstElementChild as HTMLElement | null) ?? wrapper;
        const cs = getComputedStyle(target);
        return {
          nodeId: wrapper.closest("[data-pf-node]")?.getAttribute("data-pf-node") ?? null,
          opacity: parseFloat(cs.opacity),
          transform: cs.transform,
        };
      });
    });

  const first = await sample();
  for (const entry of first) {
    if (entry.opacity < 0.95) {
      findings.push(
        buildNavFinding("QA-MO-002", {
          description: `Con prefers-reduced-motion, la sección "${entry.nodeId ?? "?"}" above-the-fold no aparece visible de inmediato (opacity=${entry.opacity}).`,
          location: { viewport, nodeId: entry.nodeId ?? undefined },
        })
      );
    }
  }

  await page.waitForTimeout(1000);
  const second = await sample();
  for (const entry of first) {
    const match = second.find((s) => s.nodeId === entry.nodeId);
    if (match && match.transform !== entry.transform) {
      findings.push(
        buildNavFinding("QA-MO-002", {
          description: `Con prefers-reduced-motion, el transform de la sección "${entry.nodeId ?? "?"}" siguió cambiando 1s después (¿animación no respeta reduced-motion?).`,
          location: { viewport, nodeId: entry.nodeId ?? undefined },
        })
      );
    }
  }

  return findings;
}

/** QA-MO-003 — cada count-up termina mostrando exactamente su valor objetivo. */
export async function checkCountUpSettled(page: Page, viewport: string): Promise<QaFindingInput[]> {
  const counts = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>("[data-pf-motion-count]")).map((el) => ({
      nodeId: el.closest("[data-pf-node]")?.getAttribute("data-pf-node") ?? null,
      text: el.textContent ?? "",
      raw: el.getAttribute("data-pf-motion-count") ?? "",
    }))
  );

  return counts
    .filter((count) => !countSettledAtTarget(count.text, count.raw))
    .map((count) =>
      buildNavFinding("QA-MO-003", {
        description: `El count-up de la sección "${count.nodeId ?? "?"}" no llegó a su valor objetivo en ${viewport} (mostrado="${count.text}", objetivo="${count.raw}").`,
        location: { viewport, nodeId: count.nodeId ?? undefined },
        evidence: { displayed: count.text, target: count.raw },
      })
    );
}

/** QA-MO-005 — la animación de entrada del CTA principal no bloquea su propia interacción. */
export async function checkCtaNotBlocked(page: Page, viewport: string): Promise<QaFindingInput[]> {
  const probeReady = await page.evaluate(() => {
    const ctaNode = document.querySelector('[data-pf-component="cta-banner"]');
    const fallback = document.querySelector("[data-pf-node] a, [data-pf-node] button");
    const target = (ctaNode?.querySelector("a, button") as HTMLElement | null) ?? (fallback as HTMLElement | null);
    if (!target) return false;
    target.setAttribute("data-pf-qa-cta-probe", "1");
    target.scrollIntoView({ block: "center" });
    return true;
  });
  if (!probeReady) return [];

  const samples: boolean[] = [];
  for (const delay of [50, 200, 400]) {
    await page.waitForTimeout(delay);
    const hit = await page.evaluate(() => {
      const el = document.querySelector('[data-pf-qa-cta-probe="1"]');
      if (!el) return true;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const atPoint = document.elementFromPoint(cx, cy);
      return atPoint === el || (atPoint !== null && el.contains(atPoint));
    });
    samples.push(hit);
  }
  await page.evaluate(() => document.querySelector('[data-pf-qa-cta-probe="1"]')?.removeAttribute("data-pf-qa-cta-probe"));

  if (samples.every(Boolean)) return [];
  return [
    buildNavFinding("QA-MO-005", {
      description: `El CTA principal quedó tapado por otro elemento durante su animación de entrada en ${viewport} (elementFromPoint no devolvió el propio control en ${samples.filter((s) => !s).length}/${samples.length} muestras).`,
      location: { viewport, slot: "cta-banner" },
    }),
  ];
}
