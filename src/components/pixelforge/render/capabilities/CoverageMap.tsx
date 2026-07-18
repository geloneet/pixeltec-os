"use client";

/**
 * CoverageMap (capability `coverage-map-v1`) — zonas de cobertura de servicio.
 * Implementación CLIENT real de la capability certificada; su contrato
 * verificable son los `acceptanceCriteria` del registry (mirror de
 * `capabilities.test.tsx`).
 *
 * Arquitectura de capas (F6C): las capabilities NO usan el Motion System de F6B.
 * Estilo SOLO vía tokens `--pf-*` + inline styles.
 *
 * SIN MAPA EXTERNO (CSP estricta, cero red): la fuente de verdad accesible es la
 * LISTA TEXTUAL de zonas (chips). El SVG es un diagrama radial DECORATIVO,
 * determinista (ángulos por índice, sin aleatoriedad) y `aria-hidden`.
 *
 * HYDRATION-SAFETY: el formulario de búsqueda de CP es HTML estático que se
 * renderiza igual en SSR y en cliente (su visibilidad depende solo de props:
 * `buscadorPorCP` y que alguna zona traiga `codigosPostales`). El resultado de
 * la búsqueda es estado que arranca en `null` en ambos lados y solo cambia tras
 * una interacción del usuario → cero mismatch de hidratación.
 *
 * DEGRADACIÓN (D2 / criterio del registry): si `buscadorPorCP` es true pero
 * NINGUNA zona trae `codigosPostales`, el buscador NO se renderiza (chips-only)
 * en vez de mostrarse siempre vacío. Nunca lanza ante props degeneradas.
 */
import { useId, useMemo, useState } from "react";
import { matchZonaByCp, type CpMatchResult } from "@/lib/pixelforge/render/cp-match";

interface Zona {
  nombre: string;
  poligonoOrRadio: string;
  codigosPostales?: string[];
}

export interface CoverageMapProps {
  zonas: Zona[];
  buscadorPorCP?: boolean;
  mensajeFueraDeCobertura?: string;
}

const MENSAJE_FUERA_DEFAULT =
  "Por ahora no cubrimos ese código postal — contáctanos para confirmar opciones.";
const HINT_INVALIDO = "Escribe un código postal de 5 dígitos.";

type Anuncio =
  | { tipo: "match"; zona: string }
  | { tipo: "miss" }
  | { tipo: "invalid" }
  | null;

export function CoverageMap({ zonas, buscadorPorCP, mensajeFueraDeCobertura }: CoverageMapProps) {
  // Prefijo estable por instancia (SSR-safe, ver docstring ProductSelector):
  // evita que dos instancias en la misma página compartan el id del input de
  // CP (rompería la asociación label/input de la segunda instancia).
  const instanceId = useId();
  const lista = useMemo(() => (Array.isArray(zonas) ? zonas : []), [zonas]);

  // El buscador solo tiene sentido si se pidió Y hay datos de CP en alguna zona.
  const hayCodigos = lista.some(
    (zona) => Array.isArray(zona.codigosPostales) && zona.codigosPostales.length > 0
  );
  const mostrarBuscador = Boolean(buscadorPorCP) && hayCodigos;

  const [query, setQuery] = useState("");
  const [anuncio, setAnuncio] = useState<Anuncio>(null);

  const zonaResaltada = anuncio?.tipo === "match" ? anuncio.zona : null;

  const buscar = () => {
    const resultado: CpMatchResult = matchZonaByCp(query, lista);
    if (resultado.status === "invalid") {
      setAnuncio({ tipo: "invalid" });
    } else if (resultado.status === "match") {
      setAnuncio({ tipo: "match", zona: resultado.zona.nombre });
    } else {
      setAnuncio({ tipo: "miss" });
    }
  };

  const mensajeFuera = mensajeFueraDeCobertura ?? MENSAJE_FUERA_DEFAULT;

  return (
    <section
      className="pf-capability pf-coverage-map w-full"
      style={{
        backgroundColor: "var(--pf-bg)",
        color: "var(--pf-fg)",
        fontFamily: "var(--pf-font-body)",
        paddingBlock: "calc(var(--pf-space) * 5)",
        paddingInline: "calc(var(--pf-space) * 2)",
      }}
    >
      <div
        className="mx-auto flex w-full max-w-5xl flex-col md:flex-row md:items-start"
        style={{ gap: "calc(var(--pf-space) * 3)" }}
      >
        {/* Diagrama radial decorativo (NO es fuente de información). */}
        <RadialDiagram nombres={lista.map((zona) => zona.nombre)} />

        <div className="min-w-0 flex-1">
          <h2
            className="m-0 mb-4"
            style={{
              fontFamily: "var(--pf-font-display)",
              fontSize: "clamp(1.5rem, 3vw, 2.25rem)",
              fontWeight: 700,
              lineHeight: 1.1,
            }}
          >
            Zonas de cobertura
          </h2>

          {/* Fuente de verdad: lista textual de zonas como chips. */}
          <ul
            role="list"
            className="m-0 flex list-none flex-wrap p-0"
            style={{ gap: "calc(var(--pf-space) * 0.75)", marginBottom: "calc(var(--pf-space) * 2)" }}
          >
            {lista.map((zona, index) => {
              const activa = zonaResaltada === zona.nombre;
              return (
                <li key={index}>
                  <span
                    aria-current={activa ? "true" : undefined}
                    className="inline-flex flex-col"
                    style={{
                      gap: "0.15rem",
                      paddingBlock: "calc(var(--pf-space) * 0.6)",
                      paddingInline: "calc(var(--pf-space) * 1)",
                      borderRadius: "var(--pf-radius)",
                      border: `1px solid ${activa ? "var(--pf-primary)" : "var(--pf-muted)"}`,
                      backgroundColor: activa ? "var(--pf-primary)" : "var(--pf-bg)",
                      color: activa ? "var(--pf-on-primary)" : "var(--pf-fg)",
                      transition: "background-color 150ms ease, color 150ms ease",
                    }}
                  >
                    <span style={{ fontFamily: "var(--pf-font-display)", fontWeight: 600 }}>
                      {zona.nombre}
                    </span>
                    <span style={{ fontSize: "0.8rem", opacity: 0.85 }}>{zona.poligonoOrRadio}</span>
                  </span>
                </li>
              );
            })}
          </ul>

          {mostrarBuscador && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                buscar();
              }}
              className="flex flex-col"
              style={{ gap: "calc(var(--pf-space) * 0.75)", maxWidth: "28rem" }}
            >
              <label htmlFor={`${instanceId}-cp-input`} className="font-medium">
                Consulta tu código postal
              </label>
              <div className="flex" style={{ gap: "calc(var(--pf-space) * 0.5)" }}>
                <input
                  id={`${instanceId}-cp-input`}
                  type="text"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Ej. 48300"
                  className="min-w-0 flex-1 px-3 py-2"
                  style={{
                    border: "1px solid var(--pf-muted)",
                    borderRadius: "var(--pf-radius)",
                    backgroundColor: "var(--pf-bg)",
                    color: "var(--pf-fg)",
                    fontFamily: "var(--pf-font-body)",
                  }}
                />
                <button
                  type="submit"
                  className="inline-flex items-center px-4 py-2 font-semibold transition-[opacity] duration-200 hover:opacity-80"
                  style={{
                    backgroundColor: "var(--pf-primary)",
                    color: "var(--pf-on-primary)",
                    border: "none",
                    borderRadius: "var(--pf-radius)",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  Buscar
                </button>
              </div>

              {/* Región viva única: siempre presente para que el lector de
                  pantalla anuncie el cambio tras cada búsqueda. */}
              <p
                role="status"
                aria-live="polite"
                className="m-0"
                style={{ minHeight: "1.25rem", fontSize: "0.95rem" }}
              >
                {anuncio?.tipo === "match" && (
                  <span style={{ color: "var(--pf-primary)", fontWeight: 600 }}>
                    Tu código postal está dentro de la zona {anuncio.zona}.
                  </span>
                )}
                {anuncio?.tipo === "miss" && <span style={{ color: "var(--pf-fg)" }}>{mensajeFuera}</span>}
                {anuncio?.tipo === "invalid" && (
                  <span style={{ color: "var(--pf-muted)" }}>{HINT_INVALIDO}</span>
                )}
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * Diagrama radial puramente DECORATIVO: un nodo por zona colocado en un ángulo
 * determinista (índice / total), unido al centro. Sin texto legible, sin
 * aleatoriedad, `aria-hidden` — la información vive en los chips.
 */
function RadialDiagram({ nombres }: { nombres: string[] }) {
  const n = Math.max(nombres.length, 1);
  const size = 200;
  const c = size / 2;
  const r = size * 0.36;
  const puntos = nombres.map((_, index) => {
    const angulo = (index / n) * Math.PI * 2 - Math.PI / 2;
    return { x: c + r * Math.cos(angulo), y: c + r * Math.sin(angulo) };
  });

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
      style={{ maxWidth: "100%", height: "auto" }}
    >
      {puntos.map((p, index) => (
        <line
          key={`l-${index}`}
          x1={c}
          y1={c}
          x2={p.x}
          y2={p.y}
          stroke="var(--pf-muted)"
          strokeWidth={1.5}
        />
      ))}
      {puntos.map((p, index) => (
        <circle key={`c-${index}`} cx={p.x} cy={p.y} r={8} fill="var(--pf-primary)" />
      ))}
      <circle cx={c} cy={c} r={10} fill="var(--pf-accent)" />
    </svg>
  );
}
