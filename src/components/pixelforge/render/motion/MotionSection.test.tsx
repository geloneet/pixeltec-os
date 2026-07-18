// @vitest-environment jsdom
/**
 * PRIMER mock de framer-motion del repo (ver dispatch F6B-T6). Deliberadamente
 * mínimo y comentado — patrón a reutilizar por futuros tests de motion:
 *  - `framer-motion`: `LazyMotion`/`m.div` passthrough que CAPTURAN los props
 *    de motion (initial/animate/whileInView/…); `useReducedMotion` controlable
 *    vía `mockState.reducedMotion`; `useInView` controlable (default true);
 *    `useScroll` devuelve un MotionValue-like; `useMotionValueEvent` registra
 *    el callback para dispararlo hook-side desde el test.
 *  - `framer-motion/dom`: `animate`/`stagger` como spies. `animate` en su forma
 *    numérica (count-up) dispara onUpdate(final)+onComplete para que el
 *    textContent quede en su valor final observable.
 * NADA de esto anima de verdad — jsdom no ejecuta animaciones; los tests
 * observan QUÉ se pidió animar, no el resultado visual.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";

const mockState = vi.hoisted(() => ({
  reducedMotion: false as boolean | null,
  inView: true,
  capturedMotionProps: [] as Record<string, unknown>[],
  scrollListeners: [] as ((p: number) => void)[],
}));

vi.mock("framer-motion", async () => {
  const React = await import("react");
  const Div = React.forwardRef<HTMLDivElement, Record<string, unknown>>((props, ref) => {
    const { children, initial, animate, whileInView, whileHover, whileTap, transition, viewport, ...rest } =
      props as Record<string, unknown>;
    // Captura los props de motion para aserción; el resto pasa al <div> real.
    mockState.capturedMotionProps.push({ initial, animate, whileInView, whileHover, whileTap, transition, viewport });
    return React.createElement("div", { ...rest, ref }, children as React.ReactNode);
  });
  Div.displayName = "m.div";
  return {
    LazyMotion: ({ children }: { children: React.ReactNode }) => children,
    domAnimation: {},
    m: { div: Div },
    useReducedMotion: () => mockState.reducedMotion,
    useInView: () => mockState.inView,
    useScroll: () => ({ scrollYProgress: { get: () => 0 } }),
    useMotionValueEvent: (_value: unknown, _event: string, cb: (p: number) => void) => {
      mockState.scrollListeners.push(cb);
    },
  };
});

vi.mock("framer-motion/dom", () => ({
  animate: vi.fn((a: unknown, b: unknown, opts: Record<string, unknown> | undefined) => {
    // Forma numérica (count-up): lleva onUpdate al valor final y completa.
    if (typeof a === "number") {
      (opts?.onUpdate as ((v: number) => void) | undefined)?.(b as number);
      (opts?.onComplete as (() => void) | undefined)?.();
    }
    return { stop: () => {}, then: (r?: () => void) => (r?.(), Promise.resolve()) };
  }),
  stagger: vi.fn((gap: number) => gap),
}));

import { animate, stagger } from "framer-motion/dom";
import { MotionSection, SUPPORTED_RECIPE_KINDS } from "./MotionSection";
import type { ChoreographyInput, MotionSequenceInput } from "./resolve";
import { CERTIFIED_BEHAVIORS } from "@/lib/pixelforge/registry/behaviors";

const animateSpy = vi.mocked(animate);
const staggerSpy = vi.mocked(stagger);

beforeEach(() => {
  mockState.reducedMotion = false;
  mockState.inView = true;
  mockState.capturedMotionProps = [];
  mockState.scrollListeners = [];
  animateSpy.mockClear();
  staggerSpy.mockClear();
});

afterEach(() => {
  cleanup();
});

function seq(overrides: Partial<MotionSequenceInput> = {}): MotionSequenceInput {
  return {
    behaviorId: "fade-rise",
    targetSlot: "titulo",
    trigger: "load",
    order: 0,
    durationToken: "normal",
    delayStrategy: "none",
    intensity: 2,
    ...overrides,
  };
}

function choreography(sequences: MotionSequenceInput[]): ChoreographyInput {
  return {
    narrativePurpose: "Entrada.",
    motifConnection: "Refuerza el motif.",
    sequences,
    reducedMotionFallback: "Aparece sin desplazamiento.",
  };
}

/** Último `m.div` renderizado (el wrapper primario). */
function lastWrapper(): Record<string, unknown> {
  return mockState.capturedMotionProps[mockState.capturedMotionProps.length - 1];
}

describe("SUPPORTED_RECIPE_KINDS — paridad registry↔renderer", () => {
  it("cubre TODOS los kinds presentes en CERTIFIED_BEHAVIORS", () => {
    const registryKinds = new Set(CERTIFIED_BEHAVIORS.map((b) => b.recipe.kind));
    const supported = new Set<string>(SUPPORTED_RECIPE_KINDS);
    for (const kind of registryKinds) {
      expect(supported.has(kind), `kind "${kind}" del registry sin ejecutor en MotionSection`).toBe(true);
    }
  });
});

describe("MotionSection — reduced motion", () => {
  it("con reducedMotionOverride:true renderiza children DIRECTOS (sin wrapper, sin animate)", () => {
    const { container } = render(
      <MotionSection nodeId="n1" choreography={choreography([seq()])} reducedMotionOverride>
        <p>contenido</p>
      </MotionSection>
    );
    expect(screen.getByText("contenido")).toBeInTheDocument();
    // Cero wrapper de motion, cero JS de animación.
    expect(container.querySelector(".pf-motion")).toBeNull();
    expect(mockState.capturedMotionProps).toHaveLength(0);
    expect(animateSpy).not.toHaveBeenCalled();
  });

  it("con useReducedMotion() del entorno en true, también children directos", () => {
    mockState.reducedMotion = true;
    const { container } = render(
      <MotionSection nodeId="n1" choreography={choreography([seq()])}>
        <p>contenido</p>
      </MotionSection>
    );
    expect(screen.getByText("contenido")).toBeInTheDocument();
    expect(container.querySelector(".pf-motion")).toBeNull();
    expect(animateSpy).not.toHaveBeenCalled();
  });

  it("choreography undefined también degrada a children directos", () => {
    const { container } = render(
      <MotionSection nodeId="n1" choreography={undefined}>
        <p>contenido</p>
      </MotionSection>
    );
    expect(screen.getByText("contenido")).toBeInTheDocument();
    expect(container.querySelector(".pf-motion")).toBeNull();
  });
});

describe("MotionSection — tween primaria en el wrapper", () => {
  it("trigger load → initial/animate con los valores resueltos y transición en segundos", () => {
    const { container } = render(
      <MotionSection nodeId="n1" choreography={choreography([seq({ behaviorId: "fade-rise", trigger: "load" })])}>
        <p>hero</p>
      </MotionSection>
    );
    expect(container.querySelector(".pf-motion")).not.toBeNull();
    const w = lastWrapper();
    // fade-rise: hidden {opacity:0,y:24}, visible {opacity:1,y:0}. intensity 2 +
    // defaults ⇒ factor 1 ⇒ y=24 sin escalar.
    expect(w.initial).toEqual({ opacity: 0, y: 24 });
    expect(w.animate).toEqual({ opacity: 1, y: 0 });
    expect(w.whileInView).toBeUndefined();
    // normal=450ms ⇒ 0.45s; ease-out cubic-bezier.
    expect(w.transition).toMatchObject({ duration: 0.45, delay: 0, ease: [0.16, 1, 0.3, 1] });
  });

  it("trigger in-view → whileInView + viewport {once:true, amount:0.3}, sin animate", () => {
    render(
      <MotionSection nodeId="n1" choreography={choreography([seq({ behaviorId: "fade-in", trigger: "in-view" })])}>
        <p>faq</p>
      </MotionSection>
    );
    const w = lastWrapper();
    expect(w.whileInView).toEqual({ opacity: 1 });
    expect(w.initial).toEqual({ opacity: 0 });
    expect(w.viewport).toEqual({ once: true, amount: 0.3 });
    expect(w.animate).toBeUndefined();
  });
});

describe("MotionSection — stagger imperativo", () => {
  it("anima los N [data-pf-motion-item] con stagger(childStaggerMs/1000)", () => {
    render(
      <MotionSection
        nodeId="n2"
        choreography={choreography([seq({ behaviorId: "stagger-children", trigger: "load", delayStrategy: "index" })])}
      >
        <ul>
          <li data-pf-motion-item="">A</li>
          <li data-pf-motion-item="">B</li>
          <li data-pf-motion-item="">C</li>
        </ul>
      </MotionSection>
    );
    // Solo la llamada imperativa sobre elementos (primer arg = array).
    const itemCall = animateSpy.mock.calls.find((c) => Array.isArray(c[0]));
    expect(itemCall).toBeDefined();
    expect(itemCall![0]).toHaveLength(3);
    // childStaggerMs default (ritmo moderado) = round(80*1.0)=80 ⇒ 0.08s.
    expect(staggerSpy).toHaveBeenCalledWith(0.08, expect.objectContaining({ startDelay: expect.any(Number) }));
  });
});

describe("MotionSection — count-up", () => {
  it("cuenta hasta el valor final conservando prefijo/sufijo", () => {
    render(
      <MotionSection nodeId="n4" choreography={choreography([seq({ behaviorId: "count-up", trigger: "in-view" })])}>
        <span data-pf-motion-count="98%">98%</span>
      </MotionSection>
    );
    // animate numérico 0→98; onComplete restaura el texto exacto.
    expect(screen.getByText("98%")).toBeInTheDocument();
    const numericCall = animateSpy.mock.calls.find((c) => typeof c[0] === "number");
    expect(numericCall).toBeDefined();
    expect(numericCall![0]).toBe(0);
    expect(numericCall![1]).toBe(98);
  });

  it("un valor NO numérico se deja intacto (sin animate numérico)", () => {
    render(
      <MotionSection nodeId="n4" choreography={choreography([seq({ behaviorId: "count-up", trigger: "in-view" })])}>
        <span data-pf-motion-count="N/A">N/A</span>
      </MotionSection>
    );
    expect(screen.getByText("N/A")).toBeInTheDocument();
    expect(animateSpy.mock.calls.some((c) => typeof c[0] === "number")).toBe(false);
  });
});
