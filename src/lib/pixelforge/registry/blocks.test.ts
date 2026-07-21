import { describe, expect, it } from "vitest";
import {
  BLOCK_IDS,
  PIXELFORGE_BLOCKS,
  getBlockDefinition,
  getCatalogForPrompt,
  isRegisteredBlockId,
  isSafeHref,
  type BlockId,
} from "./blocks";

/**
 * Un fixture válido por block — usado para probar que cada `propsSchema`
 * acepta la forma real que la IA debería producir y rechaza `{}`. Las claves
 * de este mapa deben ser exactamente los 12 `BlockId`.
 */
const VALID_FIXTURES: Record<BlockId, unknown> = {
  "hero-split": {
    titulo: "Plomería de emergencia 24/7",
    subtitulo: "Llegamos en menos de 40 minutos a toda la CDMX",
    cta: { label: "Solicitar servicio", href: "/contacto" },
    mediaAlt: "Técnico reparando una tubería en cocina",
    badges: ["24/7", "Garantía 90 días"],
  },
  "hero-editorial": {
    titulo: "Diseñamos espacios que venden",
    kicker: "Estudio de arquitectura",
    parrafo: "Diez años convirtiendo terrenos en proyectos habitables.",
    cta: { label: "Ver portafolio", href: "#portafolio" },
  },
  "proof-logos": {
    titulo: "Confían en nosotros",
    logos: [{ nombre: "Cemex" }, { nombre: "Bimbo" }, { nombre: "Femsa" }],
  },
  "offer-tiers": {
    titulo: "Planes",
    tiers: [
      {
        nombre: "Básico",
        precio: "$999 MXN",
        periodo: "mes",
        bullets: ["1 sitio", "Soporte por email"],
        ctaLabel: "Elegir Básico",
      },
      {
        nombre: "Pro",
        precio: "$1,999 MXN",
        bullets: ["5 sitios", "Soporte prioritario", "Dominio propio"],
        destacado: true,
        ctaLabel: "Elegir Pro",
      },
    ],
  },
  "narrative-scroller": {
    pasos: [
      { titulo: "Diagnóstico", texto: "Analizamos tu negocio a fondo." },
      { titulo: "Estrategia", texto: "Definimos el ADN de tu marca." },
      { titulo: "Lanzamiento", texto: "Publicamos tu landing en producción." },
    ],
  },
  "faq-accordion": {
    titulo: "Preguntas frecuentes",
    items: [
      { pregunta: "¿Cuánto tarda el servicio?", respuesta: "En promedio 40 minutos." },
      { pregunta: "¿Tienen garantía?", respuesta: "Sí, 90 días en mano de obra." },
      { pregunta: "¿Cubren toda la ciudad?", respuesta: "Cubrimos las 16 alcaldías de la CDMX." },
    ],
  },
  "testimonial-quote": {
    quotes: [
      { texto: "Llegaron en 20 minutos y resolvieron todo.", autor: "Laura Gómez", cargo: "Dueña de restaurante" },
    ],
  },
  "cta-banner": {
    titulo: "¿Listo para empezar?",
    subtitulo: "Agenda tu diagnóstico gratuito hoy mismo.",
    cta: { label: "Agendar ahora", href: "https://wa.me/5215500000000" },
  },
  "feature-grid": {
    titulo: "Todo lo que necesitas",
    features: [
      { titulo: "Rápido", texto: "Respuesta en menos de una hora.", icono: "zap" },
      { titulo: "Seguro", texto: "Técnicos certificados." },
      { titulo: "Garantizado", texto: "90 días de garantía por escrito." },
    ],
  },
  "process-steps": {
    titulo: "Cómo trabajamos",
    pasos: [
      { numero: 1, titulo: "Contacto", texto: "Nos escribes por WhatsApp o llamada." },
      { numero: 2, titulo: "Cotización", texto: "Te enviamos un presupuesto sin compromiso." },
      { numero: 3, titulo: "Ejecución", texto: "Realizamos el trabajo en la fecha acordada." },
    ],
  },
  "stats-band": {
    stats: [
      { valor: "500+", etiqueta: "clientes atendidos" },
      { valor: "98%", etiqueta: "satisfacción" },
    ],
  },
  "footer-contact": {
    empresa: "PIXELTEC.MX",
    telefono: "+52 55 0000 0000",
    email: "hola@pixeltec.mx",
    direccion: "CDMX, México",
    links: [
      { label: "Aviso de privacidad", href: "/privacidad" },
      { label: "Términos", href: "/terminos" },
    ],
  },
};

describe("PIXELFORGE_BLOCKS", () => {
  it("tiene exactamente 12 definiciones", () => {
    expect(PIXELFORGE_BLOCKS).toHaveLength(12);
  });

  it("tiene ids únicos", () => {
    const ids = PIXELFORGE_BLOCKS.map((block) => block.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("cada block tiene variants no vacíos", () => {
    for (const block of PIXELFORGE_BLOCKS) {
      expect(block.variants.length).toBeGreaterThan(0);
    }
  });

  it("cada block tiene version 1, editableSlots y aiHints no vacíos", () => {
    for (const block of PIXELFORGE_BLOCKS) {
      expect(block.version).toBe(1);
      expect(block.editableSlots.length).toBeGreaterThan(0);
      expect(block.aiHints.length).toBeGreaterThan(0);
      expect(block.intents.length).toBeGreaterThan(0);
    }
  });

  it("allowsCinematic es true SOLO en hero-split, hero-editorial, narrative-scroller y cta-banner", () => {
    const cinematic = PIXELFORGE_BLOCKS.filter((b) => b.allowsCinematic).map((b) => b.id).sort();
    expect(cinematic).toEqual(["cta-banner", "hero-editorial", "hero-split", "narrative-scroller"].sort());
  });

  it.each(PIXELFORGE_BLOCKS.map((block) => [block.id, block] as const))(
    "propsSchema de %s rechaza {} y acepta el fixture válido",
    (id, block) => {
      expect(block.propsSchema.safeParse({}).success).toBe(false);
      const fixture = VALID_FIXTURES[id];
      const result = block.propsSchema.safeParse(fixture);
      expect(result.success).toBe(true);
    }
  );
});

describe("BLOCK_IDS / isRegisteredBlockId / getBlockDefinition", () => {
  it("BLOCK_IDS deriva 1:1 de PIXELFORGE_BLOCKS", () => {
    expect(BLOCK_IDS).toEqual(PIXELFORGE_BLOCKS.map((b) => b.id));
  });

  it("reconoce un id registrado", () => {
    expect(isRegisteredBlockId("hero-split")).toBe(true);
  });

  it("rechaza un id inexistente", () => {
    expect(isRegisteredBlockId("hero-parallax-3000")).toBe(false);
  });

  it("getBlockDefinition devuelve la definición correcta", () => {
    const def = getBlockDefinition("footer-contact");
    expect(def.id).toBe("footer-contact");
    expect(def.variants).toContain("default");
  });
});

describe("hrefs seguros (nunca javascript:)", () => {
  it("rechaza javascript: en cta.href de hero-split", () => {
    const def = getBlockDefinition("hero-split");
    const fixture = VALID_FIXTURES["hero-split"] as { cta: { label: string; href: string } };
    const malicious = {
      ...fixture,
      cta: { ...fixture.cta, href: "javascript:alert(1)" },
    };
    expect(def.propsSchema.safeParse(malicious).success).toBe(false);
  });

  it("rechaza javascript: en links[].href de footer-contact", () => {
    const def = getBlockDefinition("footer-contact");
    const fixture = VALID_FIXTURES["footer-contact"] as { links: { label: string; href: string }[] };
    const malicious = {
      ...fixture,
      links: [{ label: "Malicioso", href: "javascript:alert(document.cookie)" }],
    };
    expect(def.propsSchema.safeParse(malicious).success).toBe(false);
  });

  it("acepta '/', '#' y 'https://' como hrefs válidos", () => {
    const def = getBlockDefinition("cta-banner");
    const base = VALID_FIXTURES["cta-banner"] as { titulo: string; subtitulo: string; cta: { label: string; href: string } };
    for (const href of ["/", "#", "#seccion", "/contacto", "https://pixeltec.mx"]) {
      const candidate = { ...base, cta: { ...base.cta, href } };
      expect(def.propsSchema.safeParse(candidate).success).toBe(true);
    }
  });

  it("rechaza '//evil.com' (protocol-relative — el navegador lo resuelve como https://evil.com)", () => {
    const def = getBlockDefinition("cta-banner");
    const base = VALID_FIXTURES["cta-banner"] as { titulo: string; subtitulo: string; cta: { label: string; href: string } };
    const candidate = { ...base, cta: { ...base.cta, href: "//evil.com" } };
    expect(def.propsSchema.safeParse(candidate).success).toBe(false);
  });

  it("rechaza '/\\\\evil.com' (el navegador normaliza el backslash a protocol-relative)", () => {
    const def = getBlockDefinition("cta-banner");
    const base = VALID_FIXTURES["cta-banner"] as { titulo: string; subtitulo: string; cta: { label: string; href: string } };
    const candidate = { ...base, cta: { ...base.cta, href: "/\\evil.com" } };
    expect(def.propsSchema.safeParse(candidate).success).toBe(false);
  });
});

describe("getCatalogForPrompt", () => {
  it("contiene los 12 ids de blocks", () => {
    const text = getCatalogForPrompt();
    for (const block of PIXELFORGE_BLOCKS) {
      expect(text).toContain(block.id);
    }
  });

  it("incluye variants, intents y editableSlots de cada block", () => {
    const text = getCatalogForPrompt();
    for (const block of PIXELFORGE_BLOCKS) {
      for (const variant of block.variants) {
        expect(text).toContain(variant);
      }
      for (const slot of block.editableSlots) {
        expect(text).toContain(slot);
      }
    }
    expect(text.length).toBeGreaterThan(0);
  });
});

describe("isSafeHref (exportado de forma aditiva para PF-F8 T2 QA-TE-009)", () => {
  it("acepta rutas internas, anclas y https:// externo", () => {
    expect(isSafeHref("/contacto")).toBe(true);
    expect(isSafeHref("#seccion")).toBe(true);
    expect(isSafeHref("https://pixeltec.mx")).toBe(true);
  });

  it("rechaza javascript: y esquemas protocol-relative disfrazados de ruta interna", () => {
    expect(isSafeHref("javascript:alert(1)")).toBe(false);
    expect(isSafeHref("//evil.com")).toBe(false);
    expect(isSafeHref("/\\evil.com")).toBe(false);
    expect(isSafeHref("mailto:a@b.com")).toBe(false);
  });
});
