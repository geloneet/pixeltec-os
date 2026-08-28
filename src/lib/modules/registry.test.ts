import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  MODULES,
  getChildModules,
  getModule,
  getModuleForPath,
  getModulesByState,
  isModuleRouteEnabled,
  isModuleVisible,
  type ModuleId,
} from "./registry";
import { PALETTE_NAV_ITEMS } from "@/components/nav/command-palette-items";
import {
  NAV_AREA_ORDER,
  getSecondaryItems,
  getVisibleNavAreas,
  getVisibleNavItems,
} from "@/components/nav/nav-config";
import { ADMIN_ROUTES } from "@/lib/routes/admin-routes";
import { QUICK_LINKS } from "@/app/(admin)/_not-found-client";
import {
  INICIO_QUICK_ACTIONS,
  INICIO_STAT_CARDS,
  getVisibleQuickActions,
  getVisibleStatCards,
} from "@/components/hoy/inicio-surface";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const ADMIN_DIR = path.join(REPO_ROOT, "src/app/(admin)");

/**
 * Estados fijados por WO-2026-00132 (Funcional·Simple·Único). A diferencia
 * de WO-2026-00088, esta orden fue de BORRAR, no de ocultar: PixelForge,
 * Definición, todo el Growth Suite (Marketing/Contenido/Campañas/
 * Calendario/Publicaciones/Brand Brain), Infraestructura, Plantillas,
 * Documentos, Accesos (base de conocimiento del CRM) y el Blog legacy ya no
 * son entradas `hidden`/`legacy` del registro — se borraron del código y de
 * aquí. Por eso hoy no existe ningún módulo `hidden` ni `legacy`.
 */
const EXPECTED_STATES: Record<ModuleId, ReturnType<typeof getModule>["state"]> = {
  inicio: "active",
  clientes: "active",
  whatsapp: "protected",
  finanzas: "protected",
  blog: "active",
  seo: "active",
  usuarios: "active",
  proyectos: "active",
  cotizaciones: "active",
  notificaciones: "active",
  perfil: "active",
  "smilemore-respuestas": "active",
};

const HIDDEN_IDS = (Object.keys(EXPECTED_STATES) as ModuleId[]).filter(
  (id) => EXPECTED_STATES[id] === "hidden" || EXPECTED_STATES[id] === "legacy"
);

describe("registro central de módulos (WO-2026-00088 · renovado por WO-2026-00132)", () => {
  it("cada módulo tiene el estado decidido por la orden", () => {
    for (const m of MODULES) {
      expect(m.state, m.id).toBe(EXPECTED_STATES[m.id]);
    }
    expect(MODULES.map((m) => m.id).sort()).toEqual(Object.keys(EXPECTED_STATES).sort());
  });

  it("ids únicos y notas de decisión no vacías", () => {
    const ids = MODULES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of MODULES) expect(m.note.trim().length, m.id).toBeGreaterThan(0);
  });

  it("no hay módulos hidden/legacy hoy; legacy (si volviera a haberlo) declara a quién supersede y el padre de cada hijo existe", () => {
    expect(getModulesByState("legacy")).toEqual([]);
    expect(getModulesByState("hidden")).toEqual([]);
    for (const m of getModulesByState("legacy")) expect(m.supersededBy, m.id).toBeDefined();
    for (const m of MODULES) if (m.parent) expect(() => getModule(m.parent!)).not.toThrow();
    // Nadie tiene padre: PixelForge/Definición (los únicos hijos de "proyectos") se borraron.
    expect(getChildModules("proyectos")).toEqual([]);
  });

  it("visibilidad: todo módulo vigente (active/protected) es visible", () => {
    for (const m of MODULES) {
      expect(isModuleVisible(m.id), m.id).toBe(true);
    }
    expect(isModuleVisible("clientes")).toBe(true);
    expect(isModuleVisible("whatsapp")).toBe(true);
    expect(isModuleVisible("proyectos")).toBe(true);
    expect(isModuleVisible("cotizaciones")).toBe(true);
  });

  it("rutas: sin módulos ocultos hoy, toda ruta de un módulo registrado se sirve", () => {
    for (const id of HIDDEN_IDS) expect(isModuleRouteEnabled(id), id).toBe(false);
    for (const m of MODULES) expect(isModuleRouteEnabled(m.id), m.id).toBe(true);
  });

  it("resuelve el módulo dueño de un pathname por prefijo más largo", () => {
    expect(getModuleForPath("/proyectos/123")?.id).toBe("proyectos");
    expect(getModuleForPath("/cotizaciones")?.id).toBe("cotizaciones");
    expect(getModuleForPath("/whatsapp/x")?.id).toBe("whatsapp");
    expect(getModuleForPath("/seo/salud")?.id).toBe("seo");
    // "/blog" no es ruta del módulo blog (su ruta admin es /blog-cms).
    expect(getModuleForPath("/blog/algo")).toBeUndefined();
  });
});

describe("cobertura: toda ruta admin y todo destino del catálogo pertenecen a un módulo", () => {
  it("cada slug de ADMIN_ROUTES está cubierto por un módulo registrado", () => {
    for (const slug of ADMIN_ROUTES) {
      expect(getModuleForPath(`/${slug}`), slug).toBeDefined();
    }
  });

  it("cada destino del catálogo declara un módulo registrado y coherente con su ruta", () => {
    for (const item of PALETTE_NAV_ITEMS) {
      expect(() => getModule(item.module), item.href).not.toThrow();
      const owner = getModuleForPath(item.href);
      expect(owner?.id, `${item.href} → ${item.module}`).toBe(item.module);
    }
  });
});

describe("patrón único de guard: cada módulo oculto tiene layout.tsx con assertModuleRouteEnabled", () => {
  it("existe un layout con el guard en la raíz de cada ruta oculta (hoy: ninguna)", () => {
    expect(HIDDEN_IDS).toEqual([]);
    for (const id of HIDDEN_IDS) {
      const m = getModule(id);
      expect(m.routes.length, `${id} sin rutas`).toBeGreaterThan(0);
      for (const route of m.routes) {
        const layout = path.join(ADMIN_DIR, route, "layout.tsx");
        expect(fs.existsSync(layout), `${id}: falta ${layout}`).toBe(true);
        const src = fs.readFileSync(layout, "utf8");
        expect(src, `${id}: el layout no llama al guard`).toContain(`assertModuleRouteEnabled("${id}")`);
      }
    }
  });

  it("los módulos ocultos no usan if(false), display:none ni 'hidden' de CSS como mecanismo", () => {
    const src = fs.readFileSync(path.join(REPO_ROOT, "src/components/nav/nav-config.ts"), "utf8");
    expect(src).not.toMatch(/if\s*\(\s*false\s*\)/);
    expect(src).not.toMatch(/display:\s*none/);
  });
});

describe("superficies: un módulo oculto no aparece en ninguna", () => {
  const hiddenHrefs = new Set(
    PALETTE_NAV_ITEMS.filter((i) => !isModuleVisible(i.module)).map((i) => i.href)
  );

  it("⌘K (admin/staff) no lista destinos ocultos", () => {
    for (const item of getVisibleNavItems("admin")) {
      expect(hiddenHrefs.has(item.href), item.href).toBe(false);
    }
    expect(getVisibleNavItems("admin").map((i) => i.href)).toEqual(
      expect.arrayContaining([
        "/hoy",
        "/clientes",
        "/whatsapp",
        "/cobros",
        "/cotizaciones",
        "/proyectos",
        "/blog-cms",
        "/usuarios",
      ])
    );
  });

  it("áreas y submenús visibles no contienen destinos ocultos", () => {
    for (const area of getVisibleNavAreas("admin")) {
      for (const tab of getSecondaryItems(area)) {
        expect(hiddenHrefs.has(tab.href), `${area} → ${tab.href}`).toBe(false);
      }
    }
    for (const area of NAV_AREA_ORDER) {
      if (!getVisibleNavAreas("admin").includes(area)) {
        expect(getSecondaryItems(area), `área oculta ${area} con tabs`).toEqual([]);
      }
    }
  });

  it("quick links del 404 y superficie de Inicio no referencian módulos ocultos", () => {
    for (const link of QUICK_LINKS) expect(hiddenHrefs.has(link.href), link.href).toBe(false);
    for (const a of getVisibleQuickActions()) expect(isModuleVisible(a.module), a.href).toBe(true);
    for (const c of getVisibleStatCards()) expect(isModuleVisible(c.module), c.key).toBe(true);
    // WO-2026-00132: Trabajo (proyectos) y Cotizaciones son accesos rápidos reales, no declaraciones dormidas.
    expect(INICIO_QUICK_ACTIONS.some((a) => a.module === "proyectos")).toBe(true);
    expect(INICIO_STAT_CARDS.some((c) => c.module === "proyectos")).toBe(true);
    expect(getVisibleQuickActions().map((a) => a.href)).toEqual([
      "/clientes",
      "/cotizaciones",
      "/proyectos",
      "/cobros",
    ]);
  });
});
