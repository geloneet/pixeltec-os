"use client";

/**
 * ProductSelector (capability `product-selector-v1`) — selector guiado de
 * catálogo con filtros progresivos. Implementación CLIENT real de la capability
 * certificada; su contrato verificable son los `acceptanceCriteria` del registry
 * (mirror de `capabilities.test.tsx`).
 *
 * Arquitectura de capas (F6C): las capabilities NO usan el Motion System de F6B
 * (nada de framer-motion, nada de `data-pf-motion-*`). Estilo SOLO vía tokens
 * `--pf-*` + inline styles, idéntico idiom a los blocks (ver FeatureGrid.tsx).
 *
 * HYDRATION-SAFETY (lección F6B, obligatoria): el SSR renderiza el catálogo
 * COMPLETO y visible. El filtrado es un realce que ocurre SOLO post-mount:
 * `mounted` arranca en `false` en server y en el primer render de cliente (misma
 * estructura → sin mismatch) y un `useEffect` lo pone en `true` tras la
 * hidratación. Los radios arrancan todos en "Todas" en ambos lados, así que el
 * catálogo mostrado no diverge en la hidratación.
 *
 * DEGRADACIÓN (D2): si no hay `filtros` (vacío u omitido) o si ningún filtro
 * deriva valores reales de los atributos, se cae a un grid ESTÁTICO sin
 * fieldsets — nunca se lanza ante props degeneradas.
 */
import { useEffect, useId, useMemo, useState } from "react";

interface Opcion {
  id: string;
  nombre: string;
  atributos?: Record<string, string>;
}

export interface ProductSelectorProps {
  opciones: Opcion[];
  filtros?: string[];
}

/** Valor centinela interno para el radio "Todas" (no filtra). */
const TODAS = "";

export function ProductSelector({ opciones, filtros }: ProductSelectorProps) {
  // Prefijo estable por instancia (SSR-safe): evita que dos instancias de este
  // componente en la misma página, con el mismo `filtro`, colisionen en un solo
  // grupo de radios nativo (name compartido → un radio de la instancia B
  // desmarcaría silenciosamente el de la instancia A). `useId` es idéntico en
  // server y cliente, así que no introduce mismatch de hidratación.
  const instanceId = useId();
  const catalogo = useMemo(() => (Array.isArray(opciones) ? opciones : []), [opciones]);

  // Solo los filtros que realmente derivan valores de los atributos del catálogo
  // sobreviven como fieldsets; el resto se ignora (degradación defensiva).
  const filtrosActivos = useMemo(() => {
    const solicitados = Array.isArray(filtros) ? filtros : [];
    return solicitados
      .map((filtro) => {
        const valores = Array.from(
          new Set(
            catalogo
              .map((opcion) => opcion.atributos?.[filtro])
              .filter((valor): valor is string => typeof valor === "string" && valor.trim() !== "")
          )
        ).sort((a, b) => a.localeCompare(b, "es"));
        return { filtro, valores };
      })
      .filter((entry) => entry.valores.length > 0);
  }, [catalogo, filtros]);

  const hayFiltros = filtrosActivos.length > 0;

  const [selecciones, setSelecciones] = useState<Record<string, string>>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const seleccionDe = (filtro: string) => selecciones[filtro] ?? TODAS;

  // Pre-mount (y SSR) se muestra el catálogo completo; el filtrado aplica solo
  // post-hidratación (patrón `mounted`).
  const resultados = useMemo(() => {
    if (!mounted || !hayFiltros) return catalogo;
    return catalogo.filter((opcion) =>
      filtrosActivos.every(({ filtro }) => {
        const sel = seleccionDe(filtro);
        if (sel === TODAS) return true;
        return opcion.atributos?.[filtro] === sel;
      })
    );
  }, [mounted, hayFiltros, catalogo, filtrosActivos, selecciones]);

  const reset = () => setSelecciones({});

  const conteoTexto =
    resultados.length === 1 ? "1 opción disponible" : `${resultados.length} opciones disponibles`;

  return (
    <section
      className="pf-capability pf-product-selector w-full"
      style={{
        backgroundColor: "var(--pf-bg)",
        color: "var(--pf-fg)",
        fontFamily: "var(--pf-font-body)",
        paddingBlock: "calc(var(--pf-space) * 5)",
        paddingInline: "calc(var(--pf-space) * 2)",
      }}
    >
      <div className="mx-auto w-full max-w-6xl">
        {hayFiltros ? (
          <div
            className="flex flex-col gap-8 md:flex-row md:items-start"
            style={{ gap: "calc(var(--pf-space) * 3)" }}
          >
            {/* Panel de filtros: un fieldset de radios por filtro. */}
            <div
              className="flex shrink-0 flex-col md:w-64"
              style={{ gap: "calc(var(--pf-space) * 2)" }}
            >
              {filtrosActivos.map(({ filtro, valores }) => {
                const grupo = `${instanceId}-filtro-${filtro}`;
                const sel = seleccionDe(filtro);
                return (
                  <fieldset
                    key={filtro}
                    className="m-0 p-0"
                    style={{ border: "none" }}
                  >
                    <legend
                      className="mb-2 p-0 font-semibold capitalize"
                      style={{ fontFamily: "var(--pf-font-display)", fontSize: "1.05rem" }}
                    >
                      {filtro}
                    </legend>
                    <div className="flex flex-col" style={{ gap: "calc(var(--pf-space) * 0.5)" }}>
                      {[{ etiqueta: "Todas", valor: TODAS }, ...valores.map((valor) => ({ etiqueta: valor, valor }))].map(
                        (opt) => (
                          <label
                            key={opt.valor === TODAS ? "__todas__" : opt.valor}
                            className="inline-flex cursor-pointer items-center"
                            style={{ gap: "0.5rem" }}
                          >
                            <input
                              type="radio"
                              name={grupo}
                              value={opt.valor}
                              checked={sel === opt.valor}
                              onChange={() =>
                                setSelecciones((prev) => ({ ...prev, [filtro]: opt.valor }))
                              }
                              style={{ accentColor: "var(--pf-primary)" }}
                            />
                            <span>{opt.etiqueta}</span>
                          </label>
                        )
                      )}
                    </div>
                  </fieldset>
                );
              })}
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center justify-center px-4 py-2 font-semibold transition-[opacity] duration-200 hover:opacity-80"
                style={{
                  backgroundColor: "transparent",
                  color: "var(--pf-primary)",
                  border: "1px solid var(--pf-primary)",
                  borderRadius: "var(--pf-radius)",
                  cursor: "pointer",
                }}
              >
                Restablecer filtros
              </button>
            </div>

            {/* Resultados. */}
            <div className="min-w-0 flex-1">
              <p
                aria-live="polite"
                className="m-0 mb-4 font-medium"
                style={{ color: "var(--pf-muted)" }}
              >
                {conteoTexto}
              </p>
              {resultados.length > 0 ? (
                <ul
                  role="list"
                  className="m-0 grid list-none grid-cols-1 p-0 sm:grid-cols-2"
                  style={{ gap: "calc(var(--pf-space) * 1.5)" }}
                >
                  {resultados.map((opcion) => (
                    <OpcionCard key={opcion.id} opcion={opcion} />
                  ))}
                </ul>
              ) : (
                <div
                  role="note"
                  className="flex flex-col items-start"
                  style={{
                    gap: "calc(var(--pf-space) * 1.25)",
                    border: "1px dashed var(--pf-muted)",
                    borderRadius: "var(--pf-radius)",
                    padding: "calc(var(--pf-space) * 2.5)",
                  }}
                >
                  <p className="m-0" style={{ fontSize: "1.05rem" }}>
                    No encontramos opciones con esos filtros.
                  </p>
                  <button
                    type="button"
                    onClick={reset}
                    className="inline-flex items-center px-4 py-2 font-semibold transition-[opacity] duration-200 hover:opacity-80"
                    style={{
                      backgroundColor: "var(--pf-primary)",
                      color: "var(--pf-on-primary)",
                      border: "none",
                      borderRadius: "var(--pf-radius)",
                      cursor: "pointer",
                    }}
                  >
                    Restablecer filtros
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Sin filtros derivables → grid estático de todo el catálogo. */
          <ul
            role="list"
            className="m-0 grid list-none grid-cols-1 p-0 sm:grid-cols-2 lg:grid-cols-3"
            style={{ gap: "calc(var(--pf-space) * 1.5)" }}
          >
            {catalogo.map((opcion) => (
              <OpcionCard key={opcion.id} opcion={opcion} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function OpcionCard({ opcion }: { opcion: Opcion }) {
  const atributos = opcion.atributos ?? {};
  const pares = Object.entries(atributos).filter(([, v]) => typeof v === "string" && v.trim() !== "");
  return (
    <li
      className="flex flex-col"
      style={{
        gap: "calc(var(--pf-space) * 0.5)",
        border: "1px solid var(--pf-muted)",
        borderRadius: "var(--pf-radius)",
        padding: "calc(var(--pf-space) * 1.5)",
        backgroundColor: "var(--pf-bg)",
      }}
    >
      <h3
        className="m-0"
        style={{ fontFamily: "var(--pf-font-display)", fontSize: "1.2rem", fontWeight: 700 }}
      >
        {opcion.nombre}
      </h3>
      {pares.length > 0 && (
        <dl className="m-0 flex flex-wrap" style={{ gap: "0.5rem 1rem" }}>
          {pares.map(([clave, valor]) => (
            <div key={clave} className="flex items-baseline" style={{ gap: "0.35rem" }}>
              <dt className="font-medium capitalize" style={{ color: "var(--pf-muted)", fontSize: "0.85rem" }}>
                {clave}:
              </dt>
              <dd className="m-0" style={{ fontSize: "0.9rem" }}>
                {valor}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </li>
  );
}
