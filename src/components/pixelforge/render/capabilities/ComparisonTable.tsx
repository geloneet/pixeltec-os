"use client";

/**
 * ComparisonTable (capability `comparison-table-v1`) — tabla comparativa de
 * planes o frente a la competencia. Es la implementación CLIENT real de la
 * capability certificada; su contrato verificable son los `acceptanceCriteria`
 * del registry (mirror de `capabilities.test.tsx`).
 *
 * Arquitectura de capas (F6C): las capabilities NO usan el Motion System de F6B
 * (nada de framer-motion, nada de `data-pf-motion-*`). Estilo SOLO vía tokens
 * `--pf-*` + inline styles, idéntico idiom a los blocks (ver OfferTiers.tsx).
 *
 * HYDRATION-SAFETY (lección F6B): el SSR renderiza la tabla COMPLETA y visible
 * (todas las columnas y filas). La interactividad solo AÑADE realce: el resalte
 * de columna es estado que arranca en `null` en server y cliente por igual, y
 * solo cambia tras un click del usuario. No hay lectura de `matchMedia`/`window`
 * en render ni estructura condicional pre/post-mount → cero mismatch.
 *
 * DESVIACIÓN DOCUMENTADA del criterio "colapsa a tarjetas en móvil": el brief de
 * T3 autoriza (y recomienda) NO duplicar el contenido en markup de tarjetas —
 * eso obligaría a mantener dos copias del mismo dato y a gestionar `aria-hidden`
 * entre breakpoints, con riesgo de doble lectura para lectores de pantalla. En
 * su lugar se conserva UNA sola tabla semántica dentro de un contenedor con
 * scroll horizontal (`overflow-x: auto`), técnica accesible y sin duplicación.
 * El contrato de "no perder la etiqueta de fila" se cumple porque cada fila
 * mantiene su `<th scope="row">`, siempre visible al inicio de la fila.
 *
 * Un valor faltante (índice fuera del array `valores`, o cadena vacía) se pinta
 * como "—" (D4), nunca vacío ni `undefined`.
 */
import { useState } from "react";

interface Columna {
  nombre: string;
  destacada?: boolean;
}

interface Fila {
  etiqueta: string;
  valores: string[];
}

export interface ComparisonTableProps {
  columnas: Columna[];
  filas: Fila[];
}

/** Celda faltante o vacía → guion largo (jamás vacío/undefined). */
function cellValue(valores: string[], index: number): string {
  const raw = valores[index];
  return raw && raw.trim() !== "" ? raw : "—";
}

export function ComparisonTable({ columnas, filas }: ComparisonTableProps) {
  // Índice de la columna resaltada (o null). Arranca en null en server y
  // cliente → hydration-safe; solo cambia tras interacción del usuario.
  const [resaltada, setResaltada] = useState<number | null>(null);

  const cols = columnas ?? [];
  const rows = filas ?? [];

  return (
    <section
      className="pf-capability pf-comparison-table w-full"
      style={{
        backgroundColor: "var(--pf-bg)",
        color: "var(--pf-fg)",
        fontFamily: "var(--pf-font-body)",
        paddingBlock: "calc(var(--pf-space) * 5)",
        paddingInline: "calc(var(--pf-space) * 2)",
      }}
    >
      <div className="mx-auto w-full max-w-6xl">
        {/*
          Contenedor con scroll horizontal para viewports estrechos: mantiene UNA
          tabla semántica accesible sin duplicar contenido (ver desviación en el
          docstring). `data-pf-scroll="x"` es el gancho de test.
        */}
        <div data-pf-scroll="x" style={{ overflowX: "auto", width: "100%" }}>
          <table
            style={{
              width: "100%",
              minWidth: `${(cols.length + 1) * 9}rem`,
              borderCollapse: "collapse",
              fontSize: "0.98rem",
            }}
          >
            <caption
              className="text-left"
              style={{
                fontFamily: "var(--pf-font-display)",
                fontSize: "clamp(1.5rem, 3vw, 2.25rem)",
                fontWeight: 700,
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
                marginBottom: "calc(var(--pf-space) * 2)",
                captionSide: "top",
              }}
            >
              Comparativa
            </caption>
            <thead>
              <tr>
                {/* Esquina vacía (no es encabezado de columna ni de fila). */}
                <td style={{ borderBottom: "2px solid var(--pf-muted)", padding: "calc(var(--pf-space) * 0.75)", width: "1%" }} />
                {cols.map((col, colIndex) => {
                  const isOn = resaltada === colIndex;
                  return (
                    <th
                      key={colIndex}
                      scope="col"
                      style={{
                        borderBottom: "2px solid var(--pf-muted)",
                        borderTop: col.destacada ? "3px solid var(--pf-primary)" : "3px solid transparent",
                        padding: "calc(var(--pf-space) * 0.75)",
                        textAlign: "center",
                        verticalAlign: "bottom",
                        backgroundColor: isOn ? "var(--pf-primary)" : col.destacada ? "var(--pf-bg)" : "transparent",
                        color: isOn ? "var(--pf-on-primary)" : "var(--pf-fg)",
                        transition: "background-color 150ms ease, color 150ms ease",
                      }}
                    >
                      <span
                        className="block"
                        style={{
                          fontFamily: "var(--pf-font-display)",
                          fontSize: "1.15rem",
                          fontWeight: 700,
                        }}
                      >
                        {col.nombre}
                      </span>
                      {col.destacada && (
                        <span
                          className="mt-1 inline-flex items-center px-2 py-0.5 text-xs font-semibold uppercase"
                          style={{
                            backgroundColor: isOn ? "var(--pf-on-primary)" : "var(--pf-accent)",
                            color: isOn ? "var(--pf-primary)" : "var(--pf-on-primary)",
                            borderRadius: "999px",
                            letterSpacing: "0.06em",
                          }}
                        >
                          Recomendado
                        </span>
                      )}
                      <span className="mt-2 block">
                        <button
                          type="button"
                          aria-pressed={isOn}
                          onClick={() => setResaltada((prev) => (prev === colIndex ? null : colIndex))}
                          className="inline-flex items-center px-3 py-1 text-xs font-semibold transition-[opacity] duration-200 hover:opacity-80"
                          style={{
                            backgroundColor: "transparent",
                            color: isOn ? "var(--pf-on-primary)" : "var(--pf-primary)",
                            border: `1px solid ${isOn ? "var(--pf-on-primary)" : "var(--pf-primary)"}`,
                            borderRadius: "var(--pf-radius)",
                            cursor: "pointer",
                          }}
                        >
                          {isOn ? `Quitar resaltado de ${col.nombre}` : `Resaltar ${col.nombre}`}
                        </button>
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((fila, rowIndex) => (
                <tr key={rowIndex}>
                  <th
                    scope="row"
                    style={{
                      borderBottom: "1px solid var(--pf-muted)",
                      padding: "calc(var(--pf-space) * 0.75)",
                      textAlign: "left",
                      fontWeight: 600,
                      color: "var(--pf-fg)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {fila.etiqueta}
                  </th>
                  {cols.map((col, colIndex) => {
                    const isOn = resaltada === colIndex;
                    return (
                      <td
                        key={colIndex}
                        style={{
                          borderBottom: "1px solid var(--pf-muted)",
                          padding: "calc(var(--pf-space) * 0.75)",
                          textAlign: "center",
                          backgroundColor: isOn ? "var(--pf-primary)" : "transparent",
                          color: isOn ? "var(--pf-on-primary)" : "var(--pf-fg)",
                          fontWeight: col.destacada && !isOn ? 600 : 400,
                          transition: "background-color 150ms ease, color 150ms ease",
                        }}
                      >
                        {cellValue(fila.valores ?? [], colIndex)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
