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

describe("taxonomía Gate 1 (ADR-0030)", () => {
  it("exactamente seis áreas L1, en orden, con las etiquetas operativas", () => {
    expect(NAV_AREA_ORDER.map((a) => NAV_AREA_LABELS[a])).toEqual([
      "Hoy",
      "Trabajo",
      "Clientes",
      "Finanzas",
      "Marketing",
      "Sistema",
    ]);
  });

  it("IA, Infra, CRM, Ventas y Tareas no existen como etiquetas L1", () => {
    const labels = Object.values(NAV_AREA_LABELS);
    for (const prohibida of ["IA", "Infra", "CRM", "Ventas", "Tareas"]) {
      expect(labels, `etiqueta prohibida: ${prohibida}`).not.toContain(prohibida);
    }
  });

  it("L2 exacto por área (etiquetas de secondary nav)", () => {
    const l2 = (area: (typeof NAV_AREA_ORDER)[number]) =>
      getSecondaryItems(area).map((i) => i.secondaryLabel);
    expect(l2("hoy")).toEqual(["Hoy"]);
    expect(l2("proyectos")).toEqual(["Proyectos", "Definición", "PixelForge"]);
    expect(l2("crm")).toEqual(["Cuentas", "PixelBot"]);
    expect(l2("finanzas")).toEqual(["Cobros"]);
    expect(l2("marketing")).toEqual([
      "Resumen",
      "Blog",
      "Contenido",
      "Campañas",
      "Calendario",
      "Publicación",
    ]);
    expect(l2("infra")).toEqual(["Infraestructura", "Conocimiento", "Plantillas"]);
  });

  it("Configuración de marca: en ⌘K y en el área Marketing, pero fuera de la secondary nav", () => {
    expect(getNavLabel("/crecimiento/brand-brain")).toBe("Configuración de marca");
    expect(getItemArea("/crecimiento/brand-brain")).toBe("marketing");
    const tabs = getSecondaryItems("marketing").map((i) => i.href);
    expect(tabs).not.toContain("/crecimiento/brand-brain");
  });

  it("/documentos está fuera de la navegación y en ⌘K como Archivo documental", () => {
    expect(getItemArea("/documentos")).toBeUndefined();
    expect(getNavLabel("/documentos")).toBe("Archivo documental");
    for (const area of NAV_AREA_ORDER) {
      expect(getSecondaryItems(area).map((i) => i.href)).not.toContain("/documentos");
    }
  });

  it("Notificaciones y Perfil son transversales: en ⌘K, sin área ni overflow", () => {
    expect(getItemArea("/notificaciones")).toBeUndefined();
    expect(getItemArea("/perfil")).toBeUndefined();
    expect(getNavLabel("/notificaciones")).toBe("Notificaciones");
    expect(getNavLabel("/perfil")).toBe("Perfil y seguridad");
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
    expect(getActiveArea("/proyectos/pixelforge/abc/contexto")).toBe("proyectos");
    expect(getActiveArea("/proyectos/123")).toBe("proyectos");
    expect(getActiveArea("/clientes/cli-1")).toBe("crm");
    expect(getActiveArea("/whatsapp")).toBe("crm");
    expect(getActiveArea("/cobros")).toBe("finanzas");
    expect(getActiveArea("/blog-admin/p9/editar")).toBe("marketing");
    expect(getActiveArea("/crecimiento")).toBe("marketing");
    expect(getActiveArea("/crecimiento/campanas/c1")).toBe("marketing");
    expect(getActiveArea("/crecimiento/brand-brain/b1")).toBe("marketing");
    expect(getActiveArea("/vps")).toBe("infra");
    expect(getActiveArea("/accesos/tool-1")).toBe("infra");
    expect(getActiveArea("/ia-factory")).toBe("infra");
  });

  it("las rutas transversales no encienden ningún pill", () => {
    expect(getActiveArea("/documentos")).toBeNull();
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
