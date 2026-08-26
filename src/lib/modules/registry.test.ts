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

/** Estados fijados por la orden de Miguel (WO-2026-00088 §3). */
const EXPECTED_STATES: Record<ModuleId, ReturnType<typeof getModule>["state"]> = {
  inicio: "active",
  clientes: "active",
  whatsapp: "protected",
  finanzas: "protected",
  blog: "active",
  seo: "active",
  usuarios: "active",
  // Oculto por orden de Miguel (2026-08-26): la base de conocimiento del CRM
  // no debe aparecer en ninguna superficie (criterio 2 de WO-2026-00088).
  accesos: "hidden",
  notificaciones: "active",
  perfil: "active",
  "smilemore-respuestas": "active",
  proyectos: "hidden",
  definicion: "hidden",
  pixelforge: "hidden",
  marketing: "hidden",
  contenido: "hidden",
  campanas: "hidden",
  calendario: "hidden",
  publicaciones: "hidden",
  "brand-brain": "hidden",
  infraestructura: "hidden",
  plantillas: "hidden",
  documentos: "hidden",
  "blog-legacy": "legacy",
};

const HIDDEN_IDS = (Object.keys(EXPECTED_STATES) as ModuleId[]).filter(
  (id) => EXPECTED_STATES[id] === "hidden" || EXPECTED_STATES[id] === "legacy"
);

describe("registro central de módulos (WO-2026-00088)", () => {
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

  it("legacy declara a quién lo supersede y el padre de cada hijo existe", () => {
    for (const m of getModulesByState("legacy")) expect(m.supersededBy, m.id).toBeDefined();
    for (const m of MODULES) if (m.parent) expect(() => getModule(m.parent!)).not.toThrow();
    expect(getChildModules("proyectos").map((m) => m.id).sort()).toEqual(["definicion", "pixelforge"]);
  });

  it("visibilidad: solo active y protected", () => {
    expect(isModuleVisible("clientes")).toBe(true);
    expect(isModuleVisible("whatsapp")).toBe(true);
    expect(isModuleVisible("proyectos")).toBe(false);
    expect(isModuleVisible("blog-legacy")).toBe(false);
  });

  it("rutas: un módulo oculto sin hijos activos no se sirve; con un hijo activo, el árbol sí", () => {
    for (const id of HIDDEN_IDS) expect(isModuleRouteEnabled(id), id).toBe(false);
    expect(isModuleRouteEnabled("clientes")).toBe(true);
  });

  it("resuelve el módulo dueño de un pathname por prefijo más largo", () => {
    expect(getModuleForPath("/proyectos/definicion/abc")?.id).toBe("definicion");
    expect(getModuleForPath("/proyectos/123")?.id).toBe("proyectos");
    expect(getModuleForPath("/crecimiento/publisher")?.id).toBe("publicaciones");
    expect(getModuleForPath("/whatsapp/x")?.id).toBe("whatsapp");
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
  it("existe un layout con el guard en la raíz de cada ruta oculta", () => {
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
      expect.arrayContaining(["/hoy", "/clientes", "/whatsapp", "/cobros", "/blog-cms", "/usuarios"])
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
    // Las declaraciones completas se conservan para reactivar sin reconstruir.
    expect(INICIO_QUICK_ACTIONS.some((a) => a.module === "proyectos")).toBe(true);
    expect(INICIO_STAT_CARDS.some((c) => c.module === "proyectos")).toBe(true);
    expect(getVisibleQuickActions().map((a) => a.href)).toEqual(["/clientes", "/cobros"]);
  });
});
