"use client";

/**
 * ProcessVisualizer (capability `process-visualizer-v1`) — stepper del proceso
 * del cliente (de contacto a entrega) con el patrón ARIA tabs. Implementación
 * CLIENT real de la capability certificada; su contrato verificable son los
 * `acceptanceCriteria` del registry (mirror de `capabilities.test.tsx`).
 *
 * Arquitectura de capas (F6C): NO usa el Motion System de F6B (nada de
 * framer-motion ni animación ligada al scroll — para eso existe
 * narrative-scroller). Estilo SOLO vía tokens `--pf-*` + inline styles, idioma
 * idéntico a los blocks (ver ProcessSteps.tsx).
 *
 * HYDRATION-SAFETY (lección F6B, obligatoria): el SSR renderiza TODOS los pasos
 * con su descripción completa, en orden lineal y visibles (un visitante sin JS
 * ve el proceso entero). El colapso a "solo el panel activo" es un realce que
 * ocurre EXCLUSIVAMENTE post-mount: `mounted` arranca en `false` en server y en
 * el primer render de cliente (misma estructura → sin mismatch), y un
 * `useEffect` — que corre DESPUÉS de que la hidratación termina — lo pone en
 * `true`. Solo entonces los paneles no activos reciben el atributo `hidden`.
 * `active` arranca en 0 por igual en ambos lados, así que `aria-selected`/
 * `aria-current` tampoco divergen en la hidratación.
 *
 * Patrón tabs con activación automática (roving tabindex): ArrowLeft/Right
 * (y Up/Down), Home/End mueven la selección Y el foco a la vez.
 */
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

interface Paso {
  titulo: string;
  descripcion: string;
  duracionEstimada?: string;
}

export interface ProcessVisualizerProps {
  pasos: Paso[];
}

export function ProcessVisualizer({ pasos }: ProcessVisualizerProps) {
  const steps = pasos ?? [];
  const count = steps.length;

  const [active, setActive] = useState(0);
  const [mounted, setMounted] = useState(false);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Post-hidratación: recién aquí se colapsa a un solo panel (ver docstring).
  useEffect(() => {
    setMounted(true);
  }, []);

  const select = (index: number) => {
    setActive(index);
    tabRefs.current[index]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (count === 0) return;
    let next: number | null = null;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        next = (active + 1) % count;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        next = (active - 1 + count) % count;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = count - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    select(next);
  };

  return (
    <section
      className="pf-capability pf-process-visualizer w-full"
      style={{
        backgroundColor: "var(--pf-bg)",
        color: "var(--pf-fg)",
        fontFamily: "var(--pf-font-body)",
        paddingBlock: "calc(var(--pf-space) * 5)",
        paddingInline: "calc(var(--pf-space) * 2)",
      }}
    >
      <div className="mx-auto w-full max-w-4xl">
        {/* Cabeceras de paso = tablist. `<ol>` conserva el orden semántico; los
            <li> son de presentación para que los hijos válidos del tablist sean
            los role=tab. */}
        <ol
          role="tablist"
          aria-label="Etapas del proceso"
          aria-orientation="horizontal"
          className="m-0 flex list-none flex-wrap p-0"
          style={{ gap: "calc(var(--pf-space) * 0.75)", marginBottom: "calc(var(--pf-space) * 2.5)" }}
        >
          {steps.map((paso, index) => {
            const selected = index === active;
            return (
              <li key={index} role="presentation" className="flex">
                <button
                  type="button"
                  role="tab"
                  id={`pv-tab-${index}`}
                  ref={(el) => {
                    tabRefs.current[index] = el;
                  }}
                  aria-selected={selected}
                  aria-controls={`pv-panel-${index}`}
                  aria-current={selected ? "step" : undefined}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => select(index)}
                  onKeyDown={onKeyDown}
                  className="inline-flex items-center transition-[background-color,color] duration-200"
                  style={{
                    gap: "0.6rem",
                    paddingBlock: "calc(var(--pf-space) * 0.75)",
                    paddingInline: "calc(var(--pf-space) * 1.25)",
                    borderRadius: "var(--pf-radius)",
                    border: `1px solid ${selected ? "var(--pf-primary)" : "var(--pf-muted)"}`,
                    backgroundColor: selected ? "var(--pf-primary)" : "var(--pf-bg)",
                    color: selected ? "var(--pf-on-primary)" : "var(--pf-fg)",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="inline-flex shrink-0 items-center justify-center font-bold"
                    style={{
                      width: "1.75rem",
                      height: "1.75rem",
                      borderRadius: "999px",
                      backgroundColor: selected ? "var(--pf-on-primary)" : "var(--pf-primary)",
                      color: selected ? "var(--pf-primary)" : "var(--pf-on-primary)",
                      fontFamily: "var(--pf-font-display)",
                      fontSize: "0.9rem",
                    }}
                  >
                    {index + 1}
                  </span>
                  <span style={{ fontFamily: "var(--pf-font-display)" }}>{paso.titulo}</span>
                </button>
              </li>
            );
          })}
        </ol>

        {/* Un tabpanel por paso. En SSR y hasta que `mounted` sea true, TODOS
            están visibles (contenido completo sin JS). Post-mount solo el activo
            queda sin `hidden`. */}
        {steps.map((paso, index) => {
          const selected = index === active;
          return (
            <div
              key={index}
              role="tabpanel"
              id={`pv-panel-${index}`}
              aria-labelledby={`pv-tab-${index}`}
              hidden={mounted && !selected}
              tabIndex={0}
              style={{
                border: "1px solid var(--pf-muted)",
                borderRadius: "var(--pf-radius)",
                padding: "calc(var(--pf-space) * 2)",
                marginBottom: "calc(var(--pf-space) * 1)",
                display: "flex",
                flexDirection: "column",
                gap: "calc(var(--pf-space) * 0.6)",
              }}
            >
              <div className="flex flex-wrap items-baseline" style={{ gap: "calc(var(--pf-space) * 1)" }}>
                <h3 className="m-0" style={{ fontFamily: "var(--pf-font-display)", fontSize: "1.4rem", fontWeight: 700, lineHeight: 1.2 }}>
                  {paso.titulo}
                </h3>
                {paso.duracionEstimada && (
                  <span
                    className="inline-flex items-center px-2 py-0.5 text-sm font-medium"
                    style={{
                      borderRadius: "999px",
                      border: "1px solid var(--pf-muted)",
                      color: "var(--pf-muted)",
                    }}
                  >
                    Duración estimada: {paso.duracionEstimada}
                  </span>
                )}
              </div>
              <p className="m-0" style={{ fontSize: "1.05rem", lineHeight: 1.6, color: "var(--pf-muted)", maxWidth: "60ch" }}>
                {paso.descripcion}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
