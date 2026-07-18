// @vitest-environment jsdom
/**
 * Tests de las Signature Capabilities client (F6C-T3). Espejo directo de los
 * `acceptanceCriteria` de `comparison-table-v1` y `process-visualizer-v1` en el
 * registry (T1) + la especificación D4 del plan.
 *
 * DESVIACIÓN DOCUMENTADA (ComparisonTable, criterio "colapsa a tarjetas"): el
 * plan D4 pedía colapsar a tarjetas en móvil, pero el propio brief de T3
 * autoriza y recomienda una desviación por a11y: renderizar UNA sola tabla
 * semántica dentro de un contenedor con scroll horizontal (`overflow-x: auto`)
 * en vez de duplicar el contenido en markup de tarjetas (lo que crearía dos
 * copias del mismo dato para lectores de pantalla). El test móvil verifica el
 * contenedor con scroll, no un markup de tarjetas duplicado.
 *
 * SSR-completo (ProcessVisualizer): el criterio "en SSR todos los pasos se
 * renderizan visibles" se verifica con `renderToStaticMarkup` (sin efectos, sin
 * JS de cliente) — es la representación exacta que ve un visitante sin
 * hidratación. El colapso a un solo panel ocurre SOLO post-mount vía estado.
 */
import { afterEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { ComparisonTable } from "./ComparisonTable";
import { ProcessVisualizer } from "./ProcessVisualizer";

afterEach(() => {
  cleanup();
});

describe("ComparisonTable", () => {
  const props = {
    columnas: [
      { nombre: "Básico" },
      { nombre: "Pro", destacada: true },
      { nombre: "Competidor" },
    ],
    filas: [
      { etiqueta: "Soporte 24/7", valores: ["No", "Sí", "No"] },
      { etiqueta: "Garantía", valores: ["30 días", "90 días"] }, // 3ª celda faltante → "—"
    ],
  };

  it("usa <table>/<caption>/<th scope> semánticos", () => {
    render(<ComparisonTable {...props} />);
    const table = screen.getByRole("table");
    expect(table).toBeInTheDocument();
    // caption presente
    expect(table.querySelector("caption")).toBeInTheDocument();
    // encabezados de columna semánticos (th scope="col")
    const colHeaders = screen.getAllByRole("columnheader");
    expect(colHeaders.length).toBeGreaterThanOrEqual(3);
    // encabezados de fila (th scope="row")
    const rowHeaders = screen.getAllByRole("rowheader");
    expect(rowHeaders.map((th) => th.textContent)).toEqual(
      expect.arrayContaining(["Soporte 24/7", "Garantía"])
    );
  });

  it("la columna destacada muestra la insignia textual 'Recomendado' (no solo color)", () => {
    render(<ComparisonTable {...props} />);
    expect(screen.getByText("Recomendado")).toBeInTheDocument();
  });

  it("cada th de columna trae un botón de resaltar con aria-pressed operable por teclado", () => {
    render(<ComparisonTable {...props} />);
    const toggles = screen.getAllByRole("button", { name: /resaltar/i });
    expect(toggles).toHaveLength(3);
    const first = toggles[0];
    // es un <button> nativo → Enter/Espacio operan sin JS extra
    expect(first.tagName).toBe("BUTTON");
    expect(first).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(first);
    expect(first).toHaveAttribute("aria-pressed", "true");
    // segundo click apaga el resaltado
    fireEvent.click(first);
    expect(first).toHaveAttribute("aria-pressed", "false");
    // teclado nativo: keyDown Enter no debe romper el botón (sigue siendo botón)
    fireEvent.keyDown(first, { key: "Enter" });
    expect(first.tagName).toBe("BUTTON");
  });

  it("un valor faltante en una celda se muestra como '—', nunca vacío", () => {
    render(<ComparisonTable {...props} />);
    // fila "Garantía" solo tiene 2 valores para 3 columnas → 3ª celda es "—"
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("envuelve la tabla en un contenedor con scroll horizontal (desviación a11y de las tarjetas)", () => {
    const { container } = render(<ComparisonTable {...props} />);
    const table = screen.getByRole("table");
    const scroller = table.closest('[data-pf-scroll="x"]') as HTMLElement | null;
    expect(scroller).not.toBeNull();
    expect(scroller).toHaveStyle({ overflowX: "auto" });
    expect(container).toBeTruthy();
  });

  it("no lanza con una sola fila y valores parciales", () => {
    expect(() =>
      render(
        <ComparisonTable
          columnas={[{ nombre: "A" }, { nombre: "B" }]}
          filas={[{ etiqueta: "Solo", valores: [] }]}
        />
      )
    ).not.toThrow();
    expect(screen.getAllByText("—")).toHaveLength(2);
  });
});

describe("ProcessVisualizer", () => {
  const props = {
    pasos: [
      { titulo: "Contacto", descripcion: "Nos escribes por WhatsApp.", duracionEstimada: "1 día" },
      { titulo: "Cotización", descripcion: "Enviamos propuesta detallada." },
      { titulo: "Instalación", descripcion: "Ejecutamos en sitio.", duracionEstimada: "3 días" },
    ],
  };

  it("sigue el patrón ARIA tablist/tab/tabpanel", () => {
    render(<ProcessVisualizer {...props} />);
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    // al menos un tabpanel presente
    expect(screen.getAllByRole("tabpanel").length).toBeGreaterThanOrEqual(1);
  });

  it("el paso activo marca aria-selected y aria-current='step'", () => {
    render(<ProcessVisualizer {...props} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[0]).toHaveAttribute("aria-current", "step");
    expect(tabs[1]).toHaveAttribute("aria-selected", "false");
  });

  it("navega con flechas: mueve aria-selected y el foco (roving tabindex)", () => {
    render(<ProcessVisualizer {...props} />);
    const tabs = screen.getAllByRole("tab");
    tabs[0].focus();
    fireEvent.keyDown(tabs[0], { key: "ArrowRight" });
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    expect(tabs[1]).toHaveAttribute("tabindex", "0");
    expect(tabs[0]).toHaveAttribute("tabindex", "-1");
    expect(document.activeElement).toBe(tabs[1]);
    // End → último, Home → primero
    fireEvent.keyDown(tabs[1], { key: "End" });
    expect(tabs[2]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(tabs[2], { key: "Home" });
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    // ArrowLeft desde el primero envuelve al último
    fireEvent.keyDown(tabs[0], { key: "ArrowLeft" });
    expect(tabs[2]).toHaveAttribute("aria-selected", "true");
  });

  it("muestra duracionEstimada cuando está presente", () => {
    render(<ProcessVisualizer {...props} />);
    // paso 0 activo trae duración "1 día"
    expect(screen.getByText(/1 día/)).toBeInTheDocument();
  });

  it("SSR (sin JS) renderiza TODOS los pasos y descripciones visibles", () => {
    const html = renderToStaticMarkup(<ProcessVisualizer {...props} />);
    expect(html).toContain("Nos escribes por WhatsApp.");
    expect(html).toContain("Enviamos propuesta detallada.");
    expect(html).toContain("Ejecutamos en sitio.");
    // ningún panel oculto en el SSR: el atributo booleano `hidden` (que serializa
    // como ` hidden=""`) no debe aparecer (distinto de `aria-hidden="true"`).
    expect(html).not.toContain(' hidden="');
  });

  it("no lanza con un solo paso (input borde)", () => {
    expect(() =>
      render(<ProcessVisualizer pasos={[{ titulo: "Único", descripcion: "Paso solo." }]} />)
    ).not.toThrow();
    expect(screen.getByText("Paso solo.")).toBeInTheDocument();
  });
});
