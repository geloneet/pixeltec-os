// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

/**
 * Segunda pasada visual del editor de cotizaciones (WO-2026-00104).
 *
 * Fija los criterios de aceptación que se pueden comprobar sin navegador: que
 * no se perdió ningún campo, que la mega-card desapareció, que hay dos
 * columnas con resumen fijo, y que el progressive disclosure de exclusiones y
 * notas se comporta como se pidió.
 *
 * Las server actions se mockean como en el resto de tests del workspace: sin
 * esto, el módulo arrastra next-auth al entorno jsdom.
 */
vi.mock("@/lib/quotes/actions", () => ({
  saveQuote: vi.fn(async () => ({ ok: true, data: { id: "q1" } })),
}));
// WO-2026-00222: mismo motivo — createProposal/getProposalByQuoteId también
// son server actions que arrastran next-auth.
vi.mock("@/lib/documents/proposals", () => ({
  createProposal: vi.fn(async () => "p1"),
  getProposalByQuoteId: vi.fn(async () => null),
}));

import { QuoteForm } from "./quote-form";
import { DEFAULT_EXCLUSIONS } from "@/lib/quotes/terms";
import type { QuoteView } from "./quote-shared";

afterEach(cleanup);

const baseQuote: QuoteView = {
  id: "q1",
  folio: "COT-2026-0013",
  title: "Sistema de citas",
  items: [{ description: "Desarrollo plataforma", quantity: 1, unitPriceCents: 2500000 }],
  taxEnabled: true,
  notes: "",
  validUntil: "2026-09-10T00:00:00.000Z",
  status: "borrador",
  publicToken: "tok",
  sentAt: null,
  createdAt: "2026-08-26T00:00:00.000Z",
  currency: "MXN",
  problem: "Duplicidad de citas.",
  solution: "Plataforma centralizada.",
  scopeIncluded: "Landing, panel, agenda.",
  exclusions: DEFAULT_EXCLUSIONS,
  estimatedDelivery: "4 semanas",
  paymentTerms: { type: "50_50", custom: "" },
  acceptedAt: null,
  rejectedAt: null,
  nextFollowUpAt: null,
  rejection: null,
};

function renderForm(quote: QuoteView | null = null) {
  return render(
    <QuoteForm clientId="c1" clientName="Smile More Dental" quote={quote} onCancel={() => {}} onSaved={() => {}} />,
  );
}

describe("editor de cotización — no se perdió ningún campo (criterio 2)", () => {
  it("están los 10 campos del formulario", () => {
    renderForm(baseQuote);
    for (const label of [
      "Título de la cotización",
      "Moneda",
      "Vigencia",
      "Problema a resolver",
      "Solución propuesta",
      "Alcance incluido",
      "Tiempo estimado",
      "Forma de pago",
      "Agregar IVA (16%)",
      "Concepto 1",
    ]) {
      expect(screen.getByLabelText(label), `falta ${label}`).toBeInTheDocument();
    }
  });

  it("las columnas de conceptos siguen siendo las cinco", () => {
    renderForm(baseQuote);
    expect(screen.getByLabelText("Cantidad del concepto 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Precio unitario del concepto 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Quitar concepto 1")).toBeInTheDocument();
    // El importe se calcula, no se captura: no existe como input.
    expect(screen.queryByLabelText("Importe del concepto 1")).toBeNull();
    // Aparece dos veces a propósito: en la fila del concepto y en el subtotal.
    expect(screen.getAllByText("$25,000.00").length).toBeGreaterThanOrEqual(2);
  });
});

describe("composición (criterios 5, 6, 7)", () => {
  it("el formulario ya NO vive dentro de una mega-card", () => {
    const { container } = renderForm(baseQuote);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).not.toContain("bg-card");
    expect(root.className).toContain("grid");
  });

  it("desktop usa editor + resumen lateral, apilado en móvil", () => {
    const { container } = renderForm(baseQuote);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("grid-cols-1");
    expect(root.className).toContain("lg:grid-cols-");
  });

  it("el resumen queda fijo en desktop y suelto en móvil", () => {
    const { container } = renderForm(baseQuote);
    const aside = container.querySelector("aside");
    expect(aside).not.toBeNull();
    expect(aside?.className).toContain("lg:sticky");
    // `sticky` a secas rompería el apilado en móvil.
    expect(aside?.className).not.toMatch(/(^|\s)sticky(\s|$)/);
  });

  it("el CTA principal vive dentro del resumen, no al final del formulario (criterio 13)", () => {
    const { container } = renderForm();
    const aside = container.querySelector("aside");
    expect(aside?.textContent).toContain("Crear cotización");
    expect(aside?.textContent).toContain("Cancelar");
  });
});

describe("altura y progressive disclosure (criterios 8, 9, 10)", () => {
  it("problema y solución arrancan en dos líneas", () => {
    renderForm(baseQuote);
    expect(screen.getByLabelText("Problema a resolver")).toHaveAttribute("rows", "2");
    expect(screen.getByLabelText("Solución propuesta")).toHaveAttribute("rows", "2");
  });

  it("fuera de alcance está colapsado, y su contenido sigue ahí", () => {
    renderForm(baseQuote);
    expect(screen.queryByLabelText("Fuera de alcance")).toBeNull();
    expect(screen.getByText("Condiciones estándar de PixelTEC")).toBeInTheDocument();
    expect(screen.getByText("3 exclusiones incluidas")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Condiciones estándar de PixelTEC"));
    expect(screen.getByLabelText("Fuera de alcance")).toHaveValue(DEFAULT_EXCLUSIONS);
  });

  it("las notas vacías no ocupan espacio, pero se abren al pedirlo", () => {
    renderForm(baseQuote);
    expect(screen.queryByLabelText("Notas y condiciones adicionales")).toBeNull();

    fireEvent.click(screen.getByText("Agregar notas adicionales"));
    expect(screen.getByLabelText("Notas y condiciones adicionales")).toBeInTheDocument();
  });

  it("si ya hay notas guardadas, se muestran abiertas", () => {
    renderForm({ ...baseQuote, notes: "Incluye dos revisiones." });
    expect(screen.getByLabelText("Notas y condiciones adicionales")).toHaveValue("Incluye dos revisiones.");
  });
});

describe("resumen económico (criterios 4, 12)", () => {
  it("muestra subtotal, IVA, total con la moneda y el reparto de pago", () => {
    const { container } = renderForm(baseQuote);
    const aside = container.querySelector("aside")!;
    // 25,000 + 16% = 29,000
    expect(aside.textContent).toContain("$25,000.00");
    expect(aside.textContent).toContain("$4,000.00");
    expect(aside.textContent).toContain("$29,000.00");
    expect(aside.textContent).toContain("MXN");
    // 50/50 sobre 29,000
    expect(aside.textContent).toContain("$14,500.00");
  });

  it("apagar el IVA cambia el total sin tocar el subtotal", () => {
    const { container } = renderForm(baseQuote);
    fireEvent.click(screen.getByLabelText("Agregar IVA (16%)"));
    const aside = container.querySelector("aside")!;
    expect(aside.textContent).toContain("$25,000.00");
    expect(aside.textContent).not.toContain("$29,000.00");
  });
});

/**
 * Reportado por Miguel: el aviso «La cotización necesita un título» aparecía
 * con lo que parecía un título escrito. No era un bug de estado — «Sistema de
 * citas» era el PLACEHOLDER, y el campo estaba vacío. Estos tests dejan fijado
 * que la validación responde al valor real, para que la duda no vuelva.
 */
describe("validación del CTA (reporte de Miguel)", () => {
  it("con el formulario vacío, el aviso nombra el título y el CTA está deshabilitado", () => {
    renderForm();
    expect(screen.getByText("La cotización necesita un título.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear cotización" })).toBeDisabled();
  });

  it("al escribir título y un concepto, el CTA se habilita y el aviso desaparece", () => {
    renderForm();
    fireEvent.change(screen.getByLabelText("Título de la cotización"), {
      target: { value: "Sistema de citas" },
    });
    fireEvent.change(screen.getByLabelText("Concepto 1"), { target: { value: "Desarrollo" } });

    expect(screen.getByRole("button", { name: "Crear cotización" })).toBeEnabled();
    expect(screen.queryByText("La cotización necesita un título.")).toBeNull();
  });

  it("un título vacío NO se confunde con el placeholder: el input no tiene valor", () => {
    renderForm();
    expect(screen.getByLabelText("Título de la cotización")).toHaveValue("");
  });
});

/** Los cinco microajustes de cierre pedidos por Miguel. */
describe("microajustes de cierre", () => {
  it("el encabezado contextual dice qué cotización es y de quién", () => {
    const { container } = renderForm();
    expect(container.textContent).toContain("Nueva cotización");
    expect(container.textContent).toContain("Smile More Dental");

    cleanup();
    const edited = renderForm(baseQuote);
    expect(edited.container.textContent).toContain("COT-2026-0013");
  });

  it("el precio vacío se ofrece ya como dinero, no como «0.00»", () => {
    renderForm();
    expect(screen.getByLabelText("Precio unitario del concepto 1")).toHaveAttribute("placeholder", "$0.00");
  });

  it("fuera de foco el precio se lee como dinero; al enfocar vuelve a crudo", () => {
    renderForm(baseQuote);
    const price = screen.getByLabelText("Precio unitario del concepto 1");
    expect(price).toHaveValue("$25,000.00");

    fireEvent.focus(price);
    expect(price).toHaveValue("25000.00");

    fireEvent.blur(price);
    expect(price).toHaveValue("$25,000.00");
  });

  it("escribir con formato de dinero sigue guardando el importe correcto", () => {
    renderForm(baseQuote);
    const price = screen.getByLabelText("Precio unitario del concepto 1");
    fireEvent.focus(price);
    fireEvent.change(price, { target: { value: "$1,500.50" } });
    fireEvent.blur(price);
    // 1.500,50 × 1 = 1.500,50 → con IVA 16% = 1.740,58
    expect(screen.getAllByText("$1,500.50").length).toBeGreaterThanOrEqual(1);
  });

  it("las celdas de concepto no llevan caja permanente, pero reaccionan al foco", () => {
    renderForm(baseQuote);
    const cls = screen.getByLabelText("Concepto 1").className;
    expect(cls).toContain("border-transparent");
    expect(cls).toContain("hover:border-input");
    expect(cls).toContain("focus-visible:ring-1");
  });

  it("los textareas de prosa crecen con el contenido", () => {
    renderForm(baseQuote);
    // El ref de auto-grow fija una altura explícita al montar.
    expect(screen.getByLabelText("Alcance incluido").style.height).not.toBe("");
  });
});

/**
 * El texto del CTA describe lo que hace el usuario, no el estado técnico
 * (Miguel, 2026-08-26): una cotización nueva se «crea» aunque por dentro nazca
 * en BORRADOR; una ya creada se «guarda».
 */
describe("CTA principal", () => {
  it("una cotización nueva se CREA", () => {
    renderForm();
    expect(screen.getByRole("button", { name: "Crear cotización" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Guardar borrador" })).toBeNull();
  });

  it("una cotización existente se GUARDA", () => {
    renderForm(baseQuote);
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Crear cotización" })).toBeNull();
  });
});
