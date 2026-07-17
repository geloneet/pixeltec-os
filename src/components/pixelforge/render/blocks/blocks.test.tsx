// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { HeroSplit } from "./HeroSplit";
import { CtaBanner } from "./CtaBanner";
import { FeatureGrid } from "./FeatureGrid";
import { FooterContact } from "./FooterContact";
import { RENDER_MAP } from "./index";

afterEach(() => {
  cleanup();
});

describe("HeroSplit", () => {
  const props = {
    titulo: "Plomería de emergencia 24/7",
    subtitulo: "Llegamos en menos de 40 minutos a toda la CDMX",
    cta: { label: "Solicitar servicio", href: "/contacto" },
    mediaAlt: "Técnico reparando una tubería",
    badges: ["24/7", "Garantía 90 días"],
  };

  it("renderiza un único h1, el subtítulo, el CTA y badges como lista real", () => {
    render(<HeroSplit {...props} variant="media-right" />);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1).toHaveTextContent("Plomería de emergencia 24/7");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByText(/Llegamos en menos de 40 minutos/)).toBeInTheDocument();
    const cta = screen.getByRole("link", { name: "Solicitar servicio" });
    expect(cta).toHaveAttribute("href", "/contacto");
    const badges = screen.getAllByRole("listitem");
    expect(badges).toHaveLength(2);
  });

  it("expone la media con role=img y aria-label = mediaAlt (sin <img> vacío)", () => {
    render(<HeroSplit {...props} variant="media-right" />);
    expect(screen.getByRole("img", { name: "Técnico reparando una tubería" })).toBeInTheDocument();
  });

  it("consume vars --pf-* vía style (h1 con font display, CTA con primary)", () => {
    render(<HeroSplit {...props} variant="media-right" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveStyle({ fontFamily: "var(--pf-font-display)" });
    expect(screen.getByRole("link", { name: "Solicitar servicio" })).toHaveStyle({ backgroundColor: "var(--pf-primary)" });
  });

  it("variant media-left recompone el orden de las columnas", () => {
    const { container } = render(<HeroSplit {...props} variant="media-left" />);
    const media = container.querySelector('[role="img"]');
    expect(media?.parentElement?.className).toContain("md:order-1");
  });

  it("respeta el máximo de 3 badges aunque lleguen más", () => {
    render(<HeroSplit {...props} badges={["a", "b", "c", "d", "e"]} variant="media-right" />);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });
});

describe("CtaBanner", () => {
  const props = {
    titulo: "¿Listo para empezar?",
    subtitulo: "Agenda tu diagnóstico gratuito hoy mismo.",
    cta: { label: "Agendar ahora", href: "https://wa.me/5215500000000" },
  };

  it("renderiza h2 (no h1), subtítulo y CTA con href externo", () => {
    render(<CtaBanner {...props} variant="solid" />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("¿Listo para empezar?");
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Agendar ahora" })).toHaveAttribute("href", "https://wa.me/5215500000000");
  });

  it("variant gradient usa un fondo con gradiente de marca", () => {
    const { container } = render(<CtaBanner {...props} variant="gradient" />);
    const section = container.querySelector("section")!;
    expect(section.getAttribute("style")).toContain("linear-gradient(135deg, var(--pf-primary), var(--pf-accent))");
  });

  it("variant solid usa primary plano", () => {
    const { container } = render(<CtaBanner {...props} variant="solid" />);
    const section = container.querySelector("section")!;
    expect(section.getAttribute("style")).toContain("var(--pf-primary)");
    expect(section.getAttribute("style")).not.toContain("linear-gradient");
  });

  it("omite el subtítulo cuando no se provee", () => {
    render(<CtaBanner titulo="Cierre" cta={{ label: "Ir", href: "/" }} variant="solid" />);
    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir" })).toBeInTheDocument();
  });
});

describe("FeatureGrid", () => {
  const props = {
    titulo: "Todo lo que necesitas",
    features: [
      { titulo: "Rápido", texto: "Respuesta en menos de una hora.", icono: "⚡" },
      { titulo: "Seguro", texto: "Técnicos certificados." },
      { titulo: "Garantizado", texto: "90 días de garantía." },
    ],
  };

  it("renderiza h2 + una tarjeta por feature con h3 y texto", () => {
    render(<FeatureGrid {...props} variant="3-col" />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Todo lo que necesitas");
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(3);
    expect(screen.getByText("Respuesta en menos de una hora.")).toBeInTheDocument();
  });

  it("variant 2-col cambia las columnas del grid", () => {
    const { container } = render(<FeatureGrid {...props} variant="2-col" />);
    const list = container.querySelector("ul")!;
    expect(list.className).toContain("sm:grid-cols-2");
    expect(list.className).not.toContain("lg:grid-cols-3");
  });

  it("pinta el icono decorativo como aria-hidden", () => {
    const { container } = render(<FeatureGrid {...props} variant="3-col" />);
    expect(container.querySelector('[aria-hidden="true"]')?.textContent).toBe("⚡");
  });
});

describe("FooterContact", () => {
  const props = {
    empresa: "PIXELTEC.MX",
    telefono: "+52 55 0000 0000",
    email: "hola@pixeltec.mx",
    direccion: "CDMX, México",
    links: [
      { label: "Aviso de privacidad", href: "/privacidad" },
      { label: "Términos", href: "/terminos" },
    ],
  };

  it("renderiza empresa, dirección y contacto con tel:/mailto: generados", () => {
    render(<FooterContact {...props} variant="default" />);
    expect(screen.getByText("PIXELTEC.MX", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("CDMX, México")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "+52 55 0000 0000" })).toHaveAttribute("href", "tel:+525500000000");
    expect(screen.getByRole("link", { name: "hola@pixeltec.mx" })).toHaveAttribute("href", "mailto:hola@pixeltec.mx");
  });

  it("renderiza los links seguros y limita a 6", () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ label: `L${i}`, href: `/l${i}` }));
    render(<FooterContact empresa="X" links={many} variant="default" />);
    expect(screen.getByRole("link", { name: "L0" })).toHaveAttribute("href", "/l0");
    expect(screen.queryByRole("link", { name: "L6" })).not.toBeInTheDocument();
  });

  it("omite contacto/dirección/links opcionales cuando faltan", () => {
    render(<FooterContact empresa="Solo Empresa" variant="default" />);
    expect(screen.getByText("Solo Empresa", { selector: "p" })).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});

describe("RENDER_MAP (paridad parcial F6A-T5)", () => {
  it("incluye los 4 blocks núcleo mapeados a un componente", () => {
    for (const id of ["hero-split", "cta-banner", "feature-grid", "footer-contact"] as const) {
      expect(typeof RENDER_MAP[id]).toBe("function");
    }
  });
});
