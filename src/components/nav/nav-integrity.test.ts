import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PALETTE_NAV_ITEMS } from "./command-palette-items";
import {
  NAV_AREA_ORDER,
  OVERFLOW_ITEMS,
  getAreaHref,
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

function extractRedirects(): Array<{ source: string; destination: string }> {
  const config = fs.readFileSync(path.join(REPO_ROOT, "next.config.ts"), "utf8");
  const out: Array<{ source: string; destination: string }> = [];
  const re = /source:\s*'([^']+)',\s*destination:\s*'([^']+)'/g;
  for (let m = re.exec(config); m; m = re.exec(config)) {
    out.push({ source: m[1], destination: m[2] });
  }
  return out;
}

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

  it("los items de overflow (Más…) apuntan a rutas reales", () => {
    for (const item of OVERFLOW_ITEMS) {
      expect(routeExists(item.href), `overflow → ${item.href}`).toBe(true);
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

  it("los destinos de navegación del menú de usuario existen", () => {
    const src = fs.readFileSync(
      path.join(REPO_ROOT, "src/components/nav/user-menu.tsx"),
      "utf8"
    );
    const targets = [...src.matchAll(/router\.push\("([^"]+)"\)/g)].map((m) => m[1]);
    expect(targets.length).toBeGreaterThan(0);
    for (const href of targets) {
      expect(routeExists(href), `user-menu → ${href}`).toBe(true);
    }
  });
});

describe("resolveActiveHref", () => {
  it("gana el prefijo más largo", () => {
    expect(resolveActiveHref(PALETTE_NAV_ITEMS, "/proyectos/pixelforge/abc")).toBe(
      "/proyectos/pixelforge"
    );
    expect(resolveActiveHref(PALETTE_NAV_ITEMS, "/proyectos/123")).toBe("/proyectos");
  });

  it("match exacto y sin match", () => {
    expect(resolveActiveHref(PALETTE_NAV_ITEMS, "/hoy")).toBe("/hoy");
    expect(resolveActiveHref(PALETTE_NAV_ITEMS, "/ruta-inexistente")).toBeNull();
  });
});
