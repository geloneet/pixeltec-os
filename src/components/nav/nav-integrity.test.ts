import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PALETTE_NAV_ITEMS, getNavLabel, type PaletteNavItem } from "./command-palette-items";
import {
  NAV_AREA_ORDER,
  NAV_AREA_LABELS,
  getAreaHref,
  getActiveArea,
  getItemArea,
  getSecondaryItems,
  getVisibleNavAreas,
  getVisibleNavItems,
  resolveActiveHref,
} from "./nav-config";
import { QUICK_LINKS } from "@/app/(admin)/_not-found-client";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const APP_DIR = path.join(REPO_ROOT, "src/app");

/**
 * Un href "existe" si, quitando query string y sufijos `/:path*` de redirect,
 * hay un page.tsx en src/app — directo o dentro del route group (admin).
 */
function routeExists(href: string): boolean {
  const clean = href.split("?")[0].replace(/\/:path\*$/, "");
  const rel = clean === "/" ? "" : clean;
  return [
    path.join(APP_DIR, rel, "page.tsx"),
    path.join(APP_DIR, "(admin)", rel, "page.tsx"),
  ].some((p) => fs.existsSync(p));
}

function extractRedirects(): Array<{ source: string; destination: string; permanent: boolean }> {
  const config = fs.readFileSync(path.join(REPO_ROOT, "next.config.ts"), "utf8");
  const out: Array<{ source: string; destination: string; permanent: boolean }> = [];
  const re = /source:\s*'([^']+)',\s*destination:\s*'([^']+)',\s*permanent:\s*(true|false)/g;
  for (let m = re.exec(config); m; m = re.exec(config)) {
    out.push({ source: m[1], destination: m[2], permanent: m[3] === "true" });
  }
  return out;
}

describe("taxonomía visible (ADR-0030 · ADR-0039 · WO-2026-00088/ADR-0054 propuesta)", () => {
  it("navegación visible para admin/staff, en orden, con las etiquetas aprobadas", () => {
    expect(getVisibleNavAreas("admin").map((a) => NAV_AREA_LABELS[a])).toEqual([
      "Inicio",
      "Clientes",
      "WhatsApp",
      "Finanzas",
      // WO-2026-00132 (Funcional·Simple·Único): Cotizaciones y Trabajo
      // reemplazan Proyectos/Definición/PixelForge.
      "Cotizaciones",
      "Trabajo",
      "Blog",
      // «SEO» añadido por orden de Miguel (2026-08-26, WO-2026-00095).
      "SEO",
      "Usuarios",
    ]);
    expect(getVisibleNavAreas("staff")).toEqual(getVisibleNavAreas("admin"));
    expect(getVisibleNavAreas(undefined)).toEqual(getVisibleNavAreas("admin"));
  });

  it("el reviewer no ve áreas y en ⌘K solo ve WhatsApp (WO-2026-00051 intacto)", () => {
    expect(getVisibleNavAreas("reviewer")).toEqual([]);
    expect(getVisibleNavItems("reviewer").map((i) => i.href)).toEqual(["/whatsapp"]);
  });

  it("«Hoy» ya no es etiqueta visible: la ruta /hoy se muestra como «Inicio»", () => {
    expect(NAV_AREA_LABELS.hoy).toBe("Inicio");
    expect(getNavLabel("/hoy")).toBe("Inicio");
    expect(getAreaHref("hoy")).toBe("/hoy");
  });

  it("IA, Infra, CRM, Ventas, Tareas, Hoy, Conocimiento y Marketing no existen como etiquetas visibles", () => {
    const visibleLabels = [
      ...getVisibleNavAreas("admin").map((a) => NAV_AREA_LABELS[a]),
      ...getVisibleNavItems("admin").map((i) => i.label),
    ];
    // "Trabajo" quedó fuera de la lista prohibida: es la etiqueta vigente del
    // área proyectos desde WO-2026-00132 (reemplaza Proyectos/PixelForge).
    for (const prohibida of ["IA", "Infra", "CRM", "Ventas", "Tareas", "Hoy", "Conocimiento", "Marketing", "Sistema"]) {
      expect(visibleLabels, `etiqueta prohibida: ${prohibida}`).not.toContain(prohibida);
    }
  });

  it("L2 exacto por área visible (etiquetas de secondary nav)", () => {
    const l2 = (area: (typeof NAV_AREA_ORDER)[number]) =>
      getSecondaryItems(area).map((i) => i.secondaryLabel);
    expect(l2("hoy")).toEqual(["Inicio"]);
    expect(l2("crm")).toEqual(["Cuentas"]);
    // PixelBot conserva su acceso (item «PixelBot» → /whatsapp) dentro de WhatsApp: excepción explícita.
    expect(l2("whatsapp")).toEqual(["PixelBot"]);
    expect(l2("finanzas")).toEqual(["Cobros"]);
    // WO-2026-00132: Cotizaciones y Trabajo (antes Proyectos/PixelForge).
    expect(l2("cotizaciones")).toEqual(["Cotizaciones"]);
    expect(l2("proyectos")).toEqual(["Trabajo"]);
    expect(l2("blog")).toEqual(["Blog"]);
    // /accesos se borró (WO-2026-00132): Usuarios conserva un solo destino.
    expect(l2("usuarios")).toEqual(["Usuarios"]);
    expect(l2("seo")).toEqual([
      "Salud",
      "llms.txt",
      "robots.txt",
      "Negocio local",
      "Datos estructurados",
      "Schema por página",
      "Redes",
      "Sitemap",
    ]);
  });

  /**
   * Regresión (2026-08-26): el módulo SEO se registró en el registro central y
   * sus rutas respondían, pero sus destinos NO estaban en PALETTE_NAV_ITEMS.
   * `areaItems()` los busca ahí, así que devolvía [] y el pill jamás se
   * dibujaba: el módulo existía y era inalcanzable desde la interfaz. Los
   * tests de entonces no lo vieron porque ninguno exigía que un área activa
   * tuviera destinos visibles.
   */
  it("toda área de un módulo ACTIVO tiene al menos un destino visible", () => {
    for (const area of getVisibleNavAreas("admin")) {
      expect(getSecondaryItems(area).length, `área ${area} sin destinos`).toBeGreaterThan(0);
    }
  });

  it("todo módulo activo con rutas de navegación aparece en alguna área visible", () => {
    const visibleHrefs = new Set(
      getVisibleNavAreas("admin").flatMap((a) => getSecondaryItems(a).map((i) => i.href))
    );
    for (const mod of ["blog", "seo", "usuarios", "clientes"] as const) {
      const some = PALETTE_NAV_ITEMS.some((i) => i.module === mod && visibleHrefs.has(i.href));
      expect(some, `el módulo ${mod} no es alcanzable desde la navegación`).toBe(true);
    }
  });

  it("D-88-2 (cerrado): /accesos se borró en WO-2026-00132, Usuarios conserva un solo destino", () => {
    expect(getItemArea("/usuarios")).toBe("usuarios");
    expect(getAreaHref("usuarios")).toBe("/usuarios");
    expect(routeExists("/usuarios")).toBe(true);
    expect(PALETTE_NAV_ITEMS.map((i) => i.href)).not.toContain("/accesos");
  });

  it("Growth Suite (Marketing/Crecimiento) se borró por completo en WO-2026-00132", () => {
    for (const href of ["/crecimiento", "/crecimiento/brand-brain", "/crecimiento/campanas"]) {
      expect(getItemArea(href), href).toBeUndefined();
      expect(PALETTE_NAV_ITEMS.map((i) => i.href), href).not.toContain(href);
    }
  });

  it("/documentos se borró por completo en WO-2026-00132: sin catálogo, sin etiqueta, sin ruta", () => {
    expect(getItemArea("/documentos")).toBeUndefined();
    expect(getVisibleNavItems("admin").map((i) => i.href)).not.toContain("/documentos");
    expect(routeExists("/documentos")).toBe(false);
  });

  it("Notificaciones y Perfil son transversales: en ⌘K, sin área ni overflow", () => {
    expect(getItemArea("/notificaciones")).toBeUndefined();
    expect(getItemArea("/perfil")).toBeUndefined();
    expect(getNavLabel("/notificaciones")).toBe("Notificaciones");
    expect(getNavLabel("/perfil")).toBe("Perfil y seguridad");
    expect(getVisibleNavItems("admin").map((i) => i.href)).toEqual(
      expect.arrayContaining(["/notificaciones", "/perfil"])
    );
  });

  it("el catálogo no contiene rutas legacy ni inexistentes", () => {
    const hrefs = PALETTE_NAV_ITEMS.map((i) => i.href);
    for (const prohibido of ["/crecimiento/analytics", "/dashboard", "/herramientas", "/crm", "/tareas", "/asistente"]) {
      expect(hrefs, `href prohibido: ${prohibido}`).not.toContain(prohibido);
    }
  });
});

describe("integridad de navegación", () => {
  it("todo item del catálogo apunta a una ruta real", () => {
    for (const item of PALETTE_NAV_ITEMS) {
      expect(routeExists(item.href), `${item.label} → ${item.href}`).toBe(true);
    }
  });

  it("toda área resuelve pill y tabs hacia rutas reales", () => {
    for (const area of NAV_AREA_ORDER) {
      expect(routeExists(getAreaHref(area)), `pill ${area}`).toBe(true);
      for (const tab of getSecondaryItems(area)) {
        expect(routeExists(tab.href), `${area} → ${tab.href}`).toBe(true);
      }
    }
  });

  it("los quick links del 404 admin apuntan a rutas reales, sin pasar por redirects", () => {
    const sources = new Set(extractRedirects().map((r) => r.source));
    for (const link of QUICK_LINKS) {
      expect(routeExists(link.href), `404 → ${link.href}`).toBe(true);
      expect(sources.has(link.href), `404 → ${link.href} depende de un redirect`).toBe(false);
    }
  });

  it("todo redirect de next.config.ts aterriza en una ruta real", () => {
    const redirects = extractRedirects();
    expect(redirects.length).toBeGreaterThan(0);
    for (const { source, destination } of redirects) {
      expect(routeExists(destination), `${source} → ${destination}`).toBe(true);
    }
  });

  it("los redirects de /asistente son temporales hacia /hoy (hasta que exista /tareas)", () => {
    const asistente = extractRedirects().filter((r) => r.source.startsWith("/asistente"));
    expect(asistente).toHaveLength(2);
    for (const r of asistente) {
      expect(r.destination, r.source).toBe("/hoy");
      expect(r.destination, r.source).not.toBe("/tareas");
      expect(r.permanent, `${r.source} debe ser temporal`).toBe(false);
    }
  });

  it("el menú de usuario tiene una sola entrada de navegación y apunta a /perfil", () => {
    const src = fs.readFileSync(
      path.join(REPO_ROOT, "src/components/nav/user-menu.tsx"),
      "utf8"
    );
    const targets = [...src.matchAll(/router\.push\("([^"]+)"\)/g)].map((m) => m[1]);
    expect(targets).toEqual(["/perfil"]);
    expect(routeExists("/perfil")).toBe(true);
  });
});

describe("resolución de área activa", () => {
  it("rutas anidadas encienden el área correcta", () => {
    expect(getActiveArea("/hoy")).toBe("hoy");
    expect(getActiveArea("/clientes/cli-1")).toBe("crm");
    expect(getActiveArea("/whatsapp")).toBe("whatsapp");
    expect(getActiveArea("/whatsapp/config")).toBe("whatsapp");
    expect(getActiveArea("/cobros")).toBe("finanzas");
    expect(getActiveArea("/blog-cms/abc/editar")).toBe("blog");
    expect(getActiveArea("/usuarios")).toBe("usuarios");
    // WO-2026-00132: Trabajo (antes oculto) y Cotizaciones (nueva) sí encienden pill.
    expect(getActiveArea("/proyectos/123")).toBe("proyectos");
    expect(getActiveArea("/cotizaciones")).toBe("cotizaciones");
  });

  it("las rutas de módulos borrados no encienden ningún pill (el registro manda)", () => {
    for (const p of [
      "/accesos",
      "/accesos/tool-1",
      "/blog-admin/p9/editar",
      "/crecimiento",
      "/crecimiento/campanas/c1",
      "/crecimiento/brand-brain/b1",
      "/vps",
      "/ia-factory",
      "/documentos",
    ]) {
      expect(getActiveArea(p), p).toBeNull();
    }
  });

  it("las rutas transversales no encienden ningún pill", () => {
    expect(getActiveArea("/notificaciones")).toBeNull();
    expect(getActiveArea("/perfil")).toBeNull();
    expect(getActiveArea("/ruta-inexistente")).toBeNull();
  });

  it("resolveActiveHref: gana el prefijo más largo", () => {
    // Sintético: el catálogo real ya no tiene rutas anidadas (PixelForge se
    // borró en WO-2026-00132), así que probamos la lógica de desempate con
    // dos destinos construidos a partir de uno real.
    const base = PALETTE_NAV_ITEMS.find((i) => i.href === "/proyectos")!;
    const items: PaletteNavItem[] = [base, { ...base, href: "/proyectos/detalle" }];
    expect(resolveActiveHref(items, "/proyectos/detalle/123")).toBe("/proyectos/detalle");
    expect(resolveActiveHref(PALETTE_NAV_ITEMS, "/hoy")).toBe("/hoy");
    expect(resolveActiveHref(PALETTE_NAV_ITEMS, "/ruta-inexistente")).toBeNull();
  });
});
