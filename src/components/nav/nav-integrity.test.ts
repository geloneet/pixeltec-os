import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PALETTE_NAV_ITEMS, getNavLabel } from "./command-palette-items";
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
      "Blog",
      // «SEO» añadido por orden de Miguel (2026-08-26, WO-2026-00095).
      "SEO",
      "Usuarios y Accesos",
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

  it("IA, Infra, CRM, Ventas, Tareas, Hoy y Conocimiento no existen como etiquetas visibles", () => {
    const visibleLabels = [
      ...getVisibleNavAreas("admin").map((a) => NAV_AREA_LABELS[a]),
      ...getVisibleNavItems("admin").map((i) => i.label),
    ];
    for (const prohibida of ["IA", "Infra", "CRM", "Ventas", "Tareas", "Hoy", "Conocimiento", "Trabajo", "Marketing", "Sistema"]) {
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
    expect(l2("blog")).toEqual(["Blog"]);
    // «Accesos» (base de conocimiento del CRM) quedó oculto por orden de
    // Miguel (2026-08-26): el área conserva su nombre y un solo destino.
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

  it("las áreas de módulos ocultos no exponen tabs ni pill", () => {
    for (const area of ["proyectos", "marketing", "infra"] as const) {
      expect(getSecondaryItems(area)).toEqual([]);
      expect(getVisibleNavAreas("admin")).not.toContain(area);
    }
  });

  it("D-88-2: Usuarios y Accesos conserva las dos rutas sin fusionarlas", () => {
    expect(getItemArea("/usuarios")).toBe("usuarios");
    expect(getItemArea("/accesos")).toBe("usuarios");
    expect(getAreaHref("usuarios")).toBe("/usuarios");
    expect(routeExists("/usuarios")).toBe(true);
    expect(routeExists("/accesos")).toBe(true);
  });

  it("Configuración de marca sigue catalogada en Marketing (oculta) y fuera de toda secondary nav", () => {
    expect(getNavLabel("/crecimiento/brand-brain")).toBe("Configuración de marca");
    expect(getItemArea("/crecimiento/brand-brain")).toBe("marketing");
    for (const area of NAV_AREA_ORDER) {
      expect(getSecondaryItems(area).map((i) => i.href)).not.toContain("/crecimiento/brand-brain");
    }
  });

  it("/documentos está fuera de la navegación, catalogado como Archivo documental y oculto en ⌘K", () => {
    expect(getItemArea("/documentos")).toBeUndefined();
    expect(getNavLabel("/documentos")).toBe("Archivo documental");
    expect(getVisibleNavItems("admin").map((i) => i.href)).not.toContain("/documentos");
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
  });

  it("las rutas de módulos ocultos no encienden ningún pill (el registro manda)", () => {
    for (const p of [
      "/proyectos/pixelforge/abc/contexto",
      "/proyectos/123",
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
    expect(resolveActiveHref(PALETTE_NAV_ITEMS, "/proyectos/pixelforge/abc")).toBe(
      "/proyectos/pixelforge"
    );
    expect(resolveActiveHref(PALETTE_NAV_ITEMS, "/crecimiento/campanas/c1")).toBe(
      "/crecimiento/campanas"
    );
    expect(resolveActiveHref(PALETTE_NAV_ITEMS, "/hoy")).toBe("/hoy");
    expect(resolveActiveHref(PALETTE_NAV_ITEMS, "/ruta-inexistente")).toBeNull();
  });
});
