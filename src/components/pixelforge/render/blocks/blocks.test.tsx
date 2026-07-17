// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { HeroSplit } from "./HeroSplit";
import { CtaBanner } from "./CtaBanner";
import { FeatureGrid } from "./FeatureGrid";
import { FooterContact } from "./FooterContact";
import { HeroEditorial } from "./HeroEditorial";
import { ProofLogos } from "./ProofLogos";
import { OfferTiers } from "./OfferTiers";
import { NarrativeScroller } from "./NarrativeScroller";
import { FaqAccordion } from "./FaqAccordion";
import { TestimonialQuote } from "./TestimonialQuote";
import { ProcessSteps } from "./ProcessSteps";
import { StatsBand } from "./StatsBand";
import { RENDER_MAP } from "./index";
import { BLOCK_IDS } from "@/lib/pixelforge/registry/blocks";

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

describe("HeroEditorial", () => {
  const props = {
    titulo: "Diseño que vende, no que decora",
    kicker: "Estudio creativo",
    parrafo: "Convertimos tu propuesta de valor en una experiencia que la gente recuerda.",
    cta: { label: "Ver portafolio", href: "/portafolio" },
  };

  it("renderiza un único h1, kicker, párrafo y CTA", () => {
    render(<HeroEditorial {...props} variant="centered" />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Diseño que vende");
    expect(screen.getByText("Estudio creativo")).toBeInTheDocument();
    expect(screen.getByText(/Convertimos tu propuesta/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver portafolio" })).toHaveAttribute("href", "/portafolio");
  });

  it("variant offset recompone a un layout asimétrico en grid", () => {
    const { container } = render(<HeroEditorial {...props} variant="offset" />);
    const inner = container.querySelector(".pf-hero-editorial > div")!;
    expect(inner.className).toContain("grid");
    expect(inner.className).not.toContain("text-center");
  });

  it("variant centered centra el contenido en una sola columna", () => {
    const { container } = render(<HeroEditorial {...props} variant="centered" />);
    const inner = container.querySelector(".pf-hero-editorial > div")!;
    expect(inner.className).toContain("text-center");
    expect(inner.className).not.toContain("grid");
  });
});

describe("ProofLogos", () => {
  const props = {
    titulo: "Con la confianza de marcas líderes",
    logos: [{ nombre: "Acme" }, { nombre: "Globex" }, { nombre: "Umbrella" }, { nombre: "Initech" }],
  };

  it("renderiza el título como h2 y cada logo como item de lista real", () => {
    render(<ProofLogos {...props} variant="row" />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Con la confianza");
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getByText("Umbrella")).toBeInTheDocument();
  });

  it("omite el título cuando no se provee", () => {
    render(<ProofLogos logos={props.logos} variant="row" />);
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
  });

  it("variant grid cambia el layout a grid", () => {
    const { container } = render(<ProofLogos {...props} variant="grid" />);
    const list = container.querySelector("ul")!;
    expect(list.className).toContain("grid");
  });
});

describe("OfferTiers", () => {
  const props = {
    titulo: "Planes a tu medida",
    tiers: [
      { nombre: "Básico", precio: "$1,990", periodo: "/mes", bullets: ["Landing de 1 sección", "Soporte por correo"], ctaLabel: "Empezar" },
      { nombre: "Pro", precio: "$3,990", periodo: "/mes", bullets: ["Landing completa", "Soporte prioritario"], destacado: true, ctaLabel: "Elegir Pro" },
    ],
  };

  it("variant cards renderiza h2, h3 por tier, precio, bullets y CTA (button sin href)", () => {
    render(<OfferTiers {...props} variant="cards" />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Planes a tu medida");
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(2);
    expect(screen.getByText("$3,990")).toBeInTheDocument();
    expect(screen.getByText("Landing completa")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Elegir Pro" })).toBeInTheDocument();
  });

  it("variant table renderiza una tabla con una columna por tier", () => {
    render(<OfferTiers {...props} variant="table" />);
    expect(screen.getByRole("table")).toBeInTheDocument();
    const headers = screen.getAllByRole("columnheader");
    expect(headers.map((h) => h.textContent)).toEqual(expect.arrayContaining([expect.stringContaining("Básico"), expect.stringContaining("Pro")]));
    expect(screen.getByRole("button", { name: "Empezar" })).toBeInTheDocument();
  });

  it("marca el tier destacado (badge Recomendado) en cards", () => {
    render(<OfferTiers {...props} variant="cards" />);
    expect(screen.getByText("Recomendado")).toBeInTheDocument();
  });
});

describe("NarrativeScroller (estático)", () => {
  const props = {
    pasos: [
      { titulo: "Descubrimiento", texto: "Entendemos tu negocio a fondo." },
      { titulo: "Diseño", texto: "Creamos la dirección visual." },
      { titulo: "Lanzamiento", texto: "Publicamos y medimos." },
    ],
  };

  it("renderiza los pasos como lista ordenada con h3 y texto", () => {
    render(<NarrativeScroller {...props} variant="default" />);
    const ol = screen.getByRole("list");
    expect(ol.tagName).toBe("OL");
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(3);
    expect(screen.getByText("Publicamos y medimos.")).toBeInTheDocument();
  });
});

describe("FaqAccordion", () => {
  const props = {
    titulo: "Preguntas frecuentes",
    items: [
      { pregunta: "¿Cuánto tarda?", respuesta: "Entre 2 y 4 semanas según el alcance." },
      { pregunta: "¿Incluye hosting?", respuesta: "Sí, el primer año va incluido." },
      { pregunta: "¿Puedo editarlo?", respuesta: "Sí, entregamos un panel editable." },
    ],
  };

  it("renderiza h2 y cada pregunta como trigger accesible (button)", () => {
    render(<FaqAccordion {...props} variant="single" />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Preguntas frecuentes");
    const triggers = screen.getAllByRole("button");
    expect(triggers).toHaveLength(3);
    expect(screen.getByRole("button", { name: /¿Cuánto tarda\?/ })).toBeInTheDocument();
  });

  it("variant two-column reparte los items en dos columnas", () => {
    const { container } = render(<FaqAccordion {...props} variant="two-column" />);
    expect(container.querySelector(".pf-faq-accordion .md\\:grid-cols-2")).toBeTruthy();
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });
});

describe("TestimonialQuote", () => {
  const props = {
    quotes: [
      { texto: "Triplicamos nuestros leads en un mes.", autor: "María López", cargo: "CEO, Café Aurora" },
      { texto: "El mejor equipo con el que hemos trabajado.", autor: "Juan Pérez" },
    ],
  };

  it("renderiza cada cita como blockquote con autor y cite del cargo", () => {
    const { container } = render(<TestimonialQuote {...props} variant="single" />);
    expect(container.querySelectorAll("blockquote")).toHaveLength(2);
    expect(screen.getByText(/Triplicamos nuestros leads/)).toBeInTheDocument();
    expect(screen.getByText("María López")).toBeInTheDocument();
    expect(container.querySelector("cite")?.textContent).toContain("CEO, Café Aurora");
  });

  it("variant carousel-static dispone las citas en una fila (grid, sin JS)", () => {
    const { container } = render(<TestimonialQuote {...props} variant="carousel-static" />);
    const list = container.querySelector("ul")!;
    expect(list.className).toContain("grid");
  });
});

describe("ProcessSteps", () => {
  const props = {
    titulo: "Cómo trabajamos",
    pasos: [
      { numero: 1, titulo: "Briefing", texto: "Nos cuentas tu idea." },
      { numero: 2, titulo: "Propuesta", texto: "Te presentamos el plan." },
      { numero: 3, titulo: "Entrega", texto: "Lanzamos tu proyecto." },
    ],
  };

  it("renderiza h2 y los pasos como lista ordenada con h3", () => {
    render(<ProcessSteps {...props} variant="vertical" />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Cómo trabajamos");
    const ol = screen.getByRole("list");
    expect(ol.tagName).toBe("OL");
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(3);
  });

  it("variant horizontal usa un layout en fila (grid)", () => {
    const { container } = render(<ProcessSteps {...props} variant="horizontal" />);
    const ol = container.querySelector("ol")!;
    expect(ol.className).toContain("grid");
  });
});

describe("StatsBand", () => {
  const props = {
    stats: [
      { valor: "+250", etiqueta: "Proyectos entregados" },
      { valor: "98%", etiqueta: "Clientes satisfechos" },
      { valor: "12", etiqueta: "Años de experiencia" },
    ],
  };

  it("renderiza cada métrica con su valor y etiqueta en un dl semántico", () => {
    const { container } = render(<StatsBand {...props} variant="default" />);
    expect(container.querySelector("dl")).toBeInTheDocument();
    expect(container.querySelectorAll("dt")).toHaveLength(3);
    expect(container.querySelectorAll("dd")).toHaveLength(3);
    expect(screen.getByText("+250")).toBeInTheDocument();
    expect(screen.getByText("Clientes satisfechos")).toBeInTheDocument();
  });
});

describe("RENDER_MAP — paridad TOTAL registry ↔ RENDER_MAP (F6A-T6)", () => {
  it("cada BlockId del registry tiene EXACTAMENTE un componente en RENDER_MAP (y viceversa)", () => {
    expect(Object.keys(RENDER_MAP).sort()).toEqual([...BLOCK_IDS].sort());
  });

  it("los 12 componentes del mapa son funciones React", () => {
    for (const id of BLOCK_IDS) {
      expect(typeof RENDER_MAP[id]).toBe("function");
    }
  });
});
