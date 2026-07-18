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
 *    textContent quede en su valor final observable. Los controls devueltos
 *    traen `stop` como `vi.fn()` (no un no-op) para poder aserir el cleanup de
 *    unmount a mitad de animación (ver F6B-T6 review, finding 2).
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
    // `stop` es un spy PROPIO por llamada (no un no-op compartido) para poder
    // aserir, por cada `animate(...)` disparado, que el cleanup de unmount lo
    // invoca — ver finding 2 de la review F6B-T6.
    return { stop: vi.fn(), then: (r?: () => void) => (r?.(), Promise.resolve()) };
  }),
  stagger: vi.fn((gap: number) => gap),
}));

import { animate, stagger } from "framer-motion/dom";
import { MotionSection, SUPPORTED_RECIPE_KINDS } from "./MotionSection";
import { DURATION_MS_BY_TOKEN, EASE_BEZIER, RHYTHM_FACTOR } from "./resolve";
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

describe("MotionSection — reduced / static (hydration-safe: wrapper INERTE)", () => {
  it("con reducedMotionOverride:true renderiza el MISMO wrapper .pf-motion pero INERTE (children intactos, sin animate, sin props de motion)", () => {
    const { container } = render(
      <MotionSection nodeId="n1" choreography={choreography([seq()])} reducedMotionOverride>
        <p>contenido</p>
      </MotionSection>
    );
    expect(screen.getByText("contenido")).toBeInTheDocument();
    // El wrapper EXISTE (paridad estructural con el modo animate) pero es inerte.
    const wrapper = container.querySelector<HTMLElement>(".pf-motion");
    expect(wrapper).not.toBeNull();
    // Cero JS de animación, cero estilos ocultos sobre el wrapper.
    expect(animateSpy).not.toHaveBeenCalled();
    expect(wrapper!.style.opacity).toBe("");
    expect(wrapper!.style.transform).toBe("");
    // Se capturó exactamente un m.div (el wrapper) SIN ningún prop de motion.
    expect(mockState.capturedMotionProps).toHaveLength(1);
    const w = lastWrapper();
    expect(w.initial).toBeUndefined();
    expect(w.animate).toBeUndefined();
    expect(w.whileInView).toBeUndefined();
    expect(w.whileHover).toBeUndefined();
    expect(w.whileTap).toBeUndefined();
  });

  it("con useReducedMotion() del entorno en true, también wrapper inerte sin animate", () => {
    mockState.reducedMotion = true;
    const { container } = render(
      <MotionSection nodeId="n1" choreography={choreography([seq()])}>
        <p>contenido</p>
      </MotionSection>
    );
    expect(screen.getByText("contenido")).toBeInTheDocument();
    expect(container.querySelector(".pf-motion")).not.toBeNull();
    expect(animateSpy).not.toHaveBeenCalled();
  });

  it("choreography undefined también degrada a wrapper inerte (contenido visible)", () => {
    const { container } = render(
      <MotionSection nodeId="n1" choreography={undefined}>
        <p>contenido</p>
      </MotionSection>
    );
    expect(screen.getByText("contenido")).toBeInTheDocument();
    expect(container.querySelector(".pf-motion")).not.toBeNull();
    expect(animateSpy).not.toHaveBeenCalled();
  });
});

describe("MotionSection — paridad estructural (regresión de hidratación)", () => {
  it("reduced=false y reduced=true producen el MISMO esqueleto (tagName + className del wrapper)", () => {
    const { container: animated } = render(
      <MotionSection nodeId="n1" choreography={choreography([seq({ behaviorId: "fade-rise", trigger: "load" })])}>
        <p>hero</p>
      </MotionSection>
    );
    const a = animated.querySelector<HTMLElement>(".pf-motion");
    expect(a).not.toBeNull();
    // Se capturan tagName/className/text ANTES de desmontar: cleanup() elimina
    // el árbol y dejaría el nodo sin hijos.
    const aTag = a!.tagName;
    const aClass = a!.className;
    const aText = a!.textContent;
    cleanup();

    const { container: reduced } = render(
      <MotionSection
        nodeId="n1"
        choreography={choreography([seq({ behaviorId: "fade-rise", trigger: "load" })])}
        reducedMotionOverride
      >
        <p>hero</p>
      </MotionSection>
    );
    const r = reduced.querySelector<HTMLElement>(".pf-motion");
    expect(r).not.toBeNull();
    // Mismo elemento wrapper en ambos modos ⇒ el SSR (siempre `animate`) y un
    // cliente reduced (`static`) hidratan sin mismatch estructural.
    expect(aTag).toBe(r!.tagName);
    expect(aClass).toBe(r!.className);
    // Y en ambos el contenido está presente (visible) dentro del wrapper.
    expect(aText).toBe("hero");
    expect(r!.textContent).toBe("hero");
  });
});

/** Llamada de `animate` cuyo primer arg es un elemento DOM (revelación imperativa: hijo del wrapper). */
function elementAnimateCall(): [unknown, unknown, Record<string, unknown> | undefined] | undefined {
  return animateSpy.mock.calls.find((c) => c[0] instanceof HTMLElement) as
    | [unknown, unknown, Record<string, unknown> | undefined]
    | undefined;
}

/** Hijo del wrapper `.pf-motion` — el elemento que SÍ recibe estilos/animaciones de motion primaria. */
function motionChild(container: HTMLElement): HTMLElement {
  const wrapper = container.querySelector<HTMLElement>(".pf-motion");
  return wrapper!.firstElementChild as HTMLElement;
}

describe("MotionSection — tween primaria IMPERATIVA sobre el HIJO (hydration-safe + IO-safe)", () => {
  it("trigger load → animate(hijo, visible, {duration,ease,delay}); hidden aplicado pre-paint al hijo; SIN initial/animate/whileInView declarativos", () => {
    const { container } = render(
      <MotionSection nodeId="n1" choreography={choreography([seq({ behaviorId: "fade-rise", trigger: "load" })])}>
        <p>hero</p>
      </MotionSection>
    );
    const wrapper = container.querySelector<HTMLElement>(".pf-motion");
    expect(wrapper).not.toBeNull();
    const child = motionChild(container);

    // El wrapper NO lleva ningún prop declarativo de motion — esa es la fuente
    // del mismatch de hidratación, ya eliminada.
    const w = lastWrapper();
    expect(w.initial).toBeUndefined();
    expect(w.animate).toBeUndefined();
    expect(w.whileInView).toBeUndefined();
    expect(w.transition).toBeUndefined();

    // INVARIANTE: el wrapper OBSERVADO por useInView no recibe estilos de motion.
    expect(wrapper!.style.opacity).toBe("");
    expect(wrapper!.style.transform).toBe("");

    // hidden aplicado pre-paint (useLayoutEffect) sobre el HIJO del wrapper.
    // fade-rise: hidden {opacity:0,y:24}. intensity 2 + defaults ⇒ factor 1.
    expect(child.style.opacity).toBe("0");
    expect(child.style.transform).toContain("translateY(24px)");

    // Revelación imperativa: animate(hijo, visible, transición en segundos).
    const call = elementAnimateCall();
    expect(call).toBeDefined();
    expect(call![0]).toBe(child);
    expect(call![1]).toEqual({ opacity: 1, y: 0 });
    // normal=450ms ⇒ 0.45s; ease-out cubic-bezier; delay "none" ⇒ 0.
    expect(call![2]).toMatchObject({ duration: 0.45, delay: 0, ease: [0.16, 1, 0.3, 1] });
  });

  it("trigger in-view + inView:true → animate(hijo, visible) gobernado por useInView", () => {
    mockState.inView = true;
    const { container } = render(
      <MotionSection nodeId="n1" choreography={choreography([seq({ behaviorId: "fade-in", trigger: "in-view" })])}>
        <p>faq</p>
      </MotionSection>
    );
    const wrapper = container.querySelector<HTMLElement>(".pf-motion");
    const child = motionChild(container);
    const w = lastWrapper();
    expect(w.whileInView).toBeUndefined();
    expect(w.animate).toBeUndefined();
    // fade-in: hidden {opacity:0}, visible {opacity:1} — sin transform. El
    // hidden va al hijo; el wrapper observado queda limpio.
    expect(wrapper!.style.opacity).toBe("");
    expect(child.style.opacity).toBe("0");
    const call = elementAnimateCall();
    expect(call).toBeDefined();
    expect(call![0]).toBe(child);
    expect(call![1]).toEqual({ opacity: 1 });
  });

  it("trigger in-view + inView:false → NO se revela (sin animate sobre ningún elemento)", () => {
    mockState.inView = false;
    render(
      <MotionSection nodeId="n1" choreography={choreography([seq({ behaviorId: "fade-in", trigger: "in-view" })])}>
        <p>faq</p>
      </MotionSection>
    );
    // El pre-paint dejó el hidden; sin inView no hay revelación imperativa.
    expect(elementAnimateCall()).toBeUndefined();
  });
});

describe("MotionSection — INVARIANTE IO-safe: el wrapper observado nunca recibe estilos de motion (deadlock clip-path, gate F6B)", () => {
  it("wipe-reveal (hidden clipPath): el wrapper .pf-motion NO lleva clipPath/opacity/transform inline; el HIJO SÍ", () => {
    // Root cause del gate F6B: `wipe-reveal` oculta con clipPath inset(0 100% 0 0).
    // Si ese clip-path cae sobre el elemento observado por useInView, en Chromium
    // su intersectionRatio colapsa a 0 y el trigger in-view nunca dispara
    // (deadlock: el contenido queda invisible para siempre). La revelación debe
    // aplicarse SIEMPRE al hijo, dejando el wrapper observado limpio.
    const { container } = render(
      <MotionSection
        nodeId="n11"
        choreography={choreography([seq({ behaviorId: "wipe-reveal", trigger: "in-view", intensity: 3 })])}
      >
        <div>cta-banner</div>
      </MotionSection>
    );
    const wrapper = container.querySelector<HTMLElement>(".pf-motion")!;
    const child = motionChild(container);

    // El wrapper OBSERVADO queda sin NINGÚN estilo de motion inline.
    expect(wrapper.style.clipPath).toBe("");
    expect(wrapper.style.opacity).toBe("");
    expect(wrapper.style.transform).toBe("");

    // El HIJO es quien carga el estado oculto (clip-path del pre-paint).
    expect(child.style.clipPath).toBe("inset(0 100% 0 0)");

    // Y la revelación imperativa apunta al hijo, no al wrapper observado.
    const call = elementAnimateCall();
    expect(call).toBeDefined();
    expect(call![0]).toBe(child);
    expect(call![0]).not.toBe(wrapper);
    expect(call![1]).toEqual({ clipPath: "inset(0)" });
  });
});

describe("MotionSection — pulse", () => {
  it("interacción + modo animate → whileHover/whileTap declarativos CON la transition del resolver (review final F6B, finding L1)", () => {
    render(
      <MotionSection
        nodeId="n1"
        choreography={choreography([seq({ behaviorId: "pulse-accent", trigger: "interaction" })])}
      >
        <button>CTA</button>
      </MotionSection>
    );
    const w = lastWrapper();
    // pulse-accent scaleAmplitude 1.03, intensity 2 + defaults ⇒ pulseScale 1.03.
    // normal=450ms x ritmo moderado(1.0) ⇒ 0.45s; ease-in-out cubic-bezier del
    // recipe — SIN esta transition explícita framer aplica su default y el
    // ritmo resuelto no tiene efecto observable sobre el pulso.
    const transition = { duration: 0.45, ease: [0.65, 0, 0.35, 1] };
    expect(w.whileHover).toEqual({ scale: 1.03, transition });
    expect(w.whileTap).toEqual({ scale: 1, transition });
    // El pulse de interacción NO es imperativo (no anima el elemento).
    expect(elementAnimateCall()).toBeUndefined();
  });

  it("interacción: la transition declarativa cambia con motionDna.ritmo (lento ≠ moderado) — antes idéntica por ignorar el resolver", () => {
    const { unmount } = render(
      <MotionSection
        nodeId="n1"
        choreography={choreography([seq({ behaviorId: "pulse-accent", trigger: "interaction" })])}
        motionDna={{ ritmo: "moderado" }}
      >
        <button>CTA</button>
      </MotionSection>
    );
    const durationModerado = (lastWrapper().whileHover as { transition: { duration: number } }).transition.duration;
    unmount();

    render(
      <MotionSection
        nodeId="n1"
        choreography={choreography([seq({ behaviorId: "pulse-accent", trigger: "interaction" })])}
        motionDna={{ ritmo: "lento" }}
      >
        <button>CTA</button>
      </MotionSection>
    );
    const durationLento = (lastWrapper().whileHover as { transition: { duration: number } }).transition.duration;

    expect(durationLento).not.toBe(durationModerado);
    expect(durationLento).toBeCloseTo(Math.round(450 * RHYTHM_FACTOR.lento) / 1000, 10);
  });

  it("in-view → ciclo de escala IMPERATIVO sobre el HIJO con duración/ease del resolver (no declarativo, sin whileInView)", () => {
    mockState.inView = true;
    const { container } = render(
      <MotionSection nodeId="n1" choreography={choreography([seq({ behaviorId: "pulse-accent", trigger: "in-view" })])}>
        <button>CTA</button>
      </MotionSection>
    );
    const child = motionChild(container);
    const w = lastWrapper();
    expect(w.whileInView).toBeUndefined();
    expect(w.whileHover).toBeUndefined();
    const call = elementAnimateCall();
    expect(call).toBeDefined();
    expect(call![0]).toBe(child);
    expect(call![1]).toEqual({ scale: [1, 1.03, 1] });
    // normal=450ms x moderado(1.0) ⇒ 0.45s; ease-in-out del recipe (finding L1:
    // antes el in-view pulse pasaba duration pero olvidaba `ease`).
    expect(call![2]).toMatchObject({ duration: 0.45, ease: [0.65, 0, 0.35, 1] });
  });

  it("in-view → la duración imperativa también responde a motionDna.ritmo", () => {
    mockState.inView = true;
    render(
      <MotionSection
        nodeId="n1"
        choreography={choreography([seq({ behaviorId: "pulse-accent", trigger: "in-view" })])}
        motionDna={{ ritmo: "lento" }}
      >
        <button>CTA</button>
      </MotionSection>
    );
    const call = elementAnimateCall();
    expect(call).toBeDefined();
    expect(call![2]).toMatchObject({ duration: Math.round(450 * RHYTHM_FACTOR.lento) / 1000 });
  });

  it("static/reduced → sin whileHover/whileTap ni animate", () => {
    render(
      <MotionSection
        nodeId="n1"
        choreography={choreography([seq({ behaviorId: "pulse-accent", trigger: "interaction" })])}
        reducedMotionOverride
      >
        <button>CTA</button>
      </MotionSection>
    );
    const w = lastWrapper();
    expect(w.whileHover).toBeUndefined();
    expect(w.whileTap).toBeUndefined();
    expect(animateSpy).not.toHaveBeenCalled();
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

describe("MotionSection — scroll-steps: transición CSS gobernada por el resolver (review F6B-T6, finding 1)", () => {
  /** Render con un solo `scroll-reveal-steps` y N items — devuelve el container para escopar las queries. */
  function renderScrollSteps(ritmo: "lento" | "moderado", itemCount = 2) {
    return render(
      <MotionSection
        nodeId="n5"
        choreography={choreography([
          seq({ behaviorId: "scroll-reveal-steps", trigger: "scroll-progress", durationToken: "normal" }),
        ])}
        motionDna={{ ritmo }}
      >
        <ul>
          {Array.from({ length: itemCount }, (_, i) => (
            <li key={i} data-pf-motion-item="">
              {i}
            </li>
          ))}
        </ul>
      </MotionSection>
    );
  }

  const [b0, b1, b2, b3] = EASE_BEZIER["ease-out"];
  const bezier = `cubic-bezier(${b0},${b1},${b2},${b3})`;

  it("pre-paint aplica la duración escalada por ritmo (NO 400ms hardcodeado) y el cubic-bezier del behavior", () => {
    const durationModerado = Math.round(DURATION_MS_BY_TOKEN.normal * RHYTHM_FACTOR.moderado);
    const { container: containerModerado } = renderScrollSteps("moderado");
    const itemsModerado = containerModerado.querySelectorAll<HTMLElement>("[data-pf-motion-item]");
    expect(itemsModerado.length).toBeGreaterThan(0);
    itemsModerado.forEach((el) => {
      expect(el.style.transition).toContain(`${durationModerado}ms`);
      expect(el.style.transition).toContain(bezier);
      // Nunca el valor hardcodeado que ignoraba al resolver.
      expect(el.style.transition).not.toContain("400ms");
    });
    cleanup();

    // ritmo distinto ⇒ durationMs distinto (RHYTHM_FACTOR.lento !== .moderado):
    // demuestra que `motionDna.ritmo` SÍ afecta el reveal de scroll-steps.
    const durationLento = Math.round(DURATION_MS_BY_TOKEN.normal * RHYTHM_FACTOR.lento);
    expect(durationLento).not.toBe(durationModerado);
    const { container: containerLento } = renderScrollSteps("lento");
    const itemsLento = containerLento.querySelectorAll<HTMLElement>("[data-pf-motion-item]");
    itemsLento.forEach((el) => {
      expect(el.style.transition).toContain(`${durationLento}ms`);
      expect(el.style.transition).toContain(bezier);
    });
  });

  it("la revelación disparada por progreso de scroll usa la MISMA transición resuelta (duración+ease)", () => {
    const duration = Math.round(DURATION_MS_BY_TOKEN.normal * RHYTHM_FACTOR.lento);
    renderScrollSteps("lento", 1);
    const item = document.querySelector<HTMLElement>("[data-pf-motion-item]")!;
    // Dispara el callback registrado vía `useMotionValueEvent` con progreso
    // total: el item cruza su umbral y pasa a `visible`.
    mockState.scrollListeners.forEach((cb) => cb(1));
    expect(item.style.opacity).toBe("1");
    expect(item.style.transition).toContain(`${duration}ms`);
    expect(item.style.transition).toContain(bezier);
  });
});

describe("MotionSection — cleanup de animaciones imperativas al desmontar (review F6B-T6, finding 2)", () => {
  it("detiene el AnimationPlaybackControls del stagger si se desmonta a mitad de animación", () => {
    const { unmount } = render(
      <MotionSection
        nodeId="n2"
        choreography={choreography([seq({ behaviorId: "stagger-children", trigger: "load", delayStrategy: "index" })])}
      >
        <ul>
          <li data-pf-motion-item="">A</li>
          <li data-pf-motion-item="">B</li>
        </ul>
      </MotionSection>
    );
    const itemCallIndex = animateSpy.mock.calls.findIndex((c) => Array.isArray(c[0]));
    expect(itemCallIndex).toBeGreaterThanOrEqual(0);
    const controls = animateSpy.mock.results[itemCallIndex]!.value as { stop: ReturnType<typeof vi.fn> };
    expect(controls.stop).not.toHaveBeenCalled();
    unmount();
    expect(controls.stop).toHaveBeenCalledTimes(1);
  });

  it("detiene TODOS los AnimationPlaybackControls del count-up (uno por cifra) si se desmonta a mitad de animación", () => {
    const { unmount } = render(
      <MotionSection nodeId="n4" choreography={choreography([seq({ behaviorId: "count-up", trigger: "in-view" })])}>
        <div>
          <span data-pf-motion-count="98%">98%</span>
          <span data-pf-motion-count="1,250">1,250</span>
        </div>
      </MotionSection>
    );
    const numericResults = animateSpy.mock.calls
      .map((call, i) => ({ call, result: animateSpy.mock.results[i]! }))
      .filter(({ call }) => typeof call[0] === "number")
      .map(({ result }) => result.value as { stop: ReturnType<typeof vi.fn> });
    expect(numericResults).toHaveLength(2);
    numericResults.forEach(({ stop }) => expect(stop).not.toHaveBeenCalled());
    unmount();
    numericResults.forEach(({ stop }) => expect(stop).toHaveBeenCalledTimes(1));
  });
});
