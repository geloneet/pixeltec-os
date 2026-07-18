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
import { ProductSelector } from "./ProductSelector";
import { CoverageMap } from "./CoverageMap";
import { CAPABILITY_RENDER_MAP } from "./index";
import { CAPABILITY_IDS } from "@/lib/pixelforge/registry/capabilities";

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

describe("ProductSelector", () => {
  const props = {
    opciones: [
      { id: "k1", nombre: "Kit Solar 3kW", atributos: { potencia: "3kW", uso: "Residencial" } },
      { id: "k2", nombre: "Kit Solar 5kW", atributos: { potencia: "5kW", uso: "Residencial" } },
      { id: "k3", nombre: "Kit Solar 10kW", atributos: { potencia: "10kW", uso: "Comercial" } },
    ],
    filtros: ["potencia", "uso"],
  };

  it("presenta cada filtro como fieldset de radios con 'Todas' + valores derivados y etiquetados", () => {
    render(<ProductSelector {...props} />);
    const groups = screen.getAllByRole("group");
    expect(groups).toHaveLength(2); // un fieldset por filtro
    // radios etiquetados (label por radio): 'Todas' por fieldset (2) + valores únicos
    expect(screen.getAllByRole("radio", { name: /todas/i })).toHaveLength(2);
    // valores derivados de atributos, deduplicados
    expect(screen.getByRole("radio", { name: "3kW" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "5kW" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "10kW" })).toBeInTheDocument();
    // 'uso' dedup: Residencial aparece UNA vez pese a 2 opciones
    expect(screen.getAllByRole("radio", { name: "Residencial" })).toHaveLength(1);
    // cada fieldset tiene legend
    groups.forEach((g) => expect(g.querySelector("legend")).toBeInTheDocument());
  });

  it("la lista de resultados usa role=list y hay una región aria-live con el conteo", () => {
    render(<ProductSelector {...props} />);
    expect(screen.getByRole("list")).toBeInTheDocument();
    const live = screen.getByText(/3 opciones disponibles/i);
    expect(live).toHaveAttribute("aria-live", "polite");
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("un filtro reduce la lista y actualiza el conteo aria-live", () => {
    render(<ProductSelector {...props} />);
    fireEvent.click(screen.getByRole("radio", { name: "Comercial" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("Kit Solar 10kW")).toBeInTheDocument();
    expect(screen.getByText(/1 opción disponible/i)).toHaveAttribute("aria-live", "polite");
  });

  it("combina filtros en AND entre fieldsets", () => {
    render(<ProductSelector {...props} />);
    fireEvent.click(screen.getByRole("radio", { name: "Residencial" }));
    fireEvent.click(screen.getByRole("radio", { name: "5kW" }));
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(screen.getByText("Kit Solar 5kW")).toBeInTheDocument();
  });

  it("muestra estado vacío con CTA de reset cuando ningún resultado coincide", () => {
    render(<ProductSelector {...props} />);
    fireEvent.click(screen.getByRole("radio", { name: "Comercial" }));
    fireEvent.click(screen.getByRole("radio", { name: "3kW" })); // Comercial + 3kW = 0
    expect(screen.queryByRole("listitem")).toBeNull();
    const vacio = screen.getByRole("note");
    expect(within(vacio).getByText(/no encontramos/i)).toBeInTheDocument();
    // CTA de reset dentro del estado vacío
    expect(within(vacio).getByRole("button", { name: /restablecer/i })).toBeInTheDocument();
  });

  it("Restablecer filtros vuelve todo a 'Todas' y restaura el catálogo completo", () => {
    render(<ProductSelector {...props} />);
    fireEvent.click(screen.getByRole("radio", { name: "Comercial" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /restablecer/i }));
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect((screen.getByRole("radio", { name: "Comercial" }) as HTMLInputElement).checked).toBe(false);
  });

  it("sin filtros configurados renderiza un grid estático sin fieldsets", () => {
    render(
      <ProductSelector
        opciones={[
          { id: "a", nombre: "Opción A" },
          { id: "b", nombre: "Opción B" },
        ]}
      />
    );
    expect(screen.queryByRole("group")).toBeNull();
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.getByText("Opción A")).toBeInTheDocument();
    expect(screen.getByText("Opción B")).toBeInTheDocument();
  });

  it("SSR (sin JS) renderiza el catálogo completo visible", () => {
    const html = renderToStaticMarkup(<ProductSelector {...props} />);
    expect(html).toContain("Kit Solar 3kW");
    expect(html).toContain("Kit Solar 5kW");
    expect(html).toContain("Kit Solar 10kW");
  });

  it("no lanza con una sola opción y filtros que no aplican", () => {
    expect(() =>
      render(<ProductSelector opciones={[{ id: "x", nombre: "Único" }]} filtros={["inexistente"]} />)
    ).not.toThrow();
    // filtro sin valores derivados → sin fieldset, grid estático
    expect(screen.queryByRole("group")).toBeNull();
    expect(screen.getByText("Único")).toBeInTheDocument();
  });

  it("dos instancias con el mismo filtro no comparten grupo de radios nativo (useId, review F6C-T4)", () => {
    const { container } = render(
      <>
        <div data-testid="instancia-a">
          <ProductSelector {...props} />
        </div>
        <div data-testid="instancia-b">
          <ProductSelector {...props} />
        </div>
      </>
    );
    const instanciaA = within(container.querySelector('[data-testid="instancia-a"]') as HTMLElement);
    const instanciaB = within(container.querySelector('[data-testid="instancia-b"]') as HTMLElement);

    // Selecciona "Comercial" en A y confirma que quedó marcado.
    fireEvent.click(instanciaA.getByRole("radio", { name: "Comercial" }));
    expect((instanciaA.getByRole("radio", { name: "Comercial" }) as HTMLInputElement).checked).toBe(true);

    // Con un `name` compartido entre instancias, marcar el radio de B
    // desmarcaría nativamente el de A (mismo grupo de radios del documento).
    fireEvent.click(instanciaB.getByRole("radio", { name: "Residencial" }));

    expect((instanciaA.getByRole("radio", { name: "Comercial" }) as HTMLInputElement).checked).toBe(true);
    expect((instanciaB.getByRole("radio", { name: "Residencial" }) as HTMLInputElement).checked).toBe(true);

    // Los `name` de radio no deben coincidir entre instancias.
    const nombreA = (instanciaA.getByRole("radio", { name: "Comercial" }) as HTMLInputElement).name;
    const nombreB = (instanciaB.getByRole("radio", { name: "Comercial" }) as HTMLInputElement).name;
    expect(nombreA).not.toBe(nombreB);
  });
});

describe("CoverageMap", () => {
  const props = {
    zonas: [
      { nombre: "Puerto Vallarta Centro", poligonoOrRadio: "5km", codigosPostales: ["48300", "48310"] },
      { nombre: "Bahía de Banderas", poligonoOrRadio: "radio 8km", codigosPostales: ["633"] },
      { nombre: "Ixtapa", poligonoOrRadio: "colonia" },
    ],
    buscadorPorCP: true,
  };

  it("renderiza todas las zonas como chips textuales (fuente de verdad)", () => {
    render(<CoverageMap {...props} />);
    expect(screen.getByText("Puerto Vallarta Centro")).toBeInTheDocument();
    expect(screen.getByText("Bahía de Banderas")).toBeInTheDocument();
    expect(screen.getByText("Ixtapa")).toBeInTheDocument();
  });

  it("el SVG decorativo lleva aria-hidden y no es la única fuente de la info", () => {
    const { container } = render(<CoverageMap {...props} />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("muestra el buscador de CP solo cuando buscadorPorCP y hay codigosPostales", () => {
    render(<CoverageMap {...props} />);
    expect(screen.getByLabelText(/consulta tu código postal/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /buscar/i })).toBeInTheDocument();
  });

  it("el input de CP limita la escritura a 5 caracteres (evita typos de más dígitos)", () => {
    render(<CoverageMap {...props} />);
    expect(screen.getByLabelText(/consulta tu código postal/i)).toHaveAttribute("maxLength", "5");
  });

  it("un CP dentro de cobertura resalta la zona y lo anuncia por aria-live", () => {
    render(<CoverageMap {...props} />);
    const input = screen.getByLabelText(/consulta tu código postal/i);
    fireEvent.change(input, { target: { value: "48300" } });
    fireEvent.click(screen.getByRole("button", { name: /buscar/i }));
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent(/dentro de la zona Puerto Vallarta Centro/i);
  });

  it("un CP fuera de cobertura muestra el mensaje personalizado sin ocultar zonas", () => {
    render(<CoverageMap {...props} mensajeFueraDeCobertura="Aún no llegamos ahí, escríbenos." />);
    fireEvent.change(screen.getByLabelText(/consulta tu código postal/i), { target: { value: "99999" } });
    fireEvent.click(screen.getByRole("button", { name: /buscar/i }));
    expect(screen.getByText("Aún no llegamos ahí, escríbenos.")).toBeInTheDocument();
    // zonas siguen visibles
    expect(screen.getByText("Puerto Vallarta Centro")).toBeInTheDocument();
  });

  it("un CP fuera de cobertura sin mensaje personalizado usa el mensaje por defecto en español", () => {
    render(<CoverageMap {...props} />);
    fireEvent.change(screen.getByLabelText(/consulta tu código postal/i), { target: { value: "99999" } });
    fireEvent.click(screen.getByRole("button", { name: /buscar/i }));
    expect(screen.getByText(/por ahora no cubrimos ese código postal/i)).toBeInTheDocument();
  });

  it("una entrada inválida (menos de 5 dígitos) da un aviso suave, no el mensaje de cobertura", () => {
    render(<CoverageMap {...props} />);
    fireEvent.change(screen.getByLabelText(/consulta tu código postal/i), { target: { value: "48" } });
    fireEvent.click(screen.getByRole("button", { name: /buscar/i }));
    expect(screen.getByRole("status")).toHaveTextContent(/5 dígitos/i);
  });

  it("oculta el buscador cuando buscadorPorCP es true pero ninguna zona trae codigosPostales", () => {
    render(
      <CoverageMap
        zonas={[
          { nombre: "Zona A", poligonoOrRadio: "5km" },
          { nombre: "Zona B", poligonoOrRadio: "colonia" },
        ]}
        buscadorPorCP
      />
    );
    expect(screen.queryByLabelText(/consulta tu código postal/i)).toBeNull();
    // pero las zonas siguen visibles (degradado chips-only)
    expect(screen.getByText("Zona A")).toBeInTheDocument();
  });

  it("no renderiza el buscador si buscadorPorCP es falso aunque haya codigosPostales", () => {
    render(<CoverageMap {...props} buscadorPorCP={false} />);
    expect(screen.queryByLabelText(/consulta tu código postal/i)).toBeNull();
  });

  it("SSR (sin JS) muestra zonas y el formulario de búsqueda estático", () => {
    const html = renderToStaticMarkup(<CoverageMap {...props} />);
    expect(html).toContain("Puerto Vallarta Centro");
    expect(html).toContain("Consulta tu código postal");
  });

  it("no lanza con una sola zona degenerada", () => {
    expect(() =>
      render(<CoverageMap zonas={[{ nombre: "Sola", poligonoOrRadio: "x" }]} />)
    ).not.toThrow();
    expect(screen.getByText("Sola")).toBeInTheDocument();
  });
});

describe("CAPABILITY_RENDER_MAP — paridad TOTAL registry ↔ CAPABILITY_RENDER_MAP (F6C-T5)", () => {
  it("cada CapabilityId certificado del registry tiene EXACTAMENTE un componente en CAPABILITY_RENDER_MAP (y viceversa)", () => {
    expect(Object.keys(CAPABILITY_RENDER_MAP).sort()).toEqual([...CAPABILITY_IDS].sort());
  });

  it("los 4 componentes del mapa son funciones React", () => {
    for (const id of CAPABILITY_IDS) {
      expect(typeof CAPABILITY_RENDER_MAP[id]).toBe("function");
    }
  });
});
