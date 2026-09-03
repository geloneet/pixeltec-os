/**
 * Registro central de módulos del dashboard de PixelTEC OS
 * (WO-2026-00088 · ADR-0054 propuesta).
 *
 * ÚNICA fuente de verdad de qué módulos están activos, protegidos, ocultos o
 * legacy. Todas las superficies (sidebar desktop, rail móvil, submenú, ⌘K,
 * accesos rápidos y widgets de Inicio, quick links del 404) y los guards de
 * ruta de los módulos ocultos leen de aquí. Nada se oculta con `if (false)`,
 * CSS, comentarios ni condiciones repartidas por pantalla.
 *
 * Reactivar un módulo = cambiar su `state` a `active` en `MODULES` (y, si el
 * módulo tiene entrada de navegación, ya está declarada en
 * `src/components/nav/command-palette-items.ts` con su `module`). Ver
 * `docs/dashboard-modules.md` para el procedimiento y las pruebas a correr.
 *
 * Estados:
 * - `active`    visible y navegable.
 * - `protected` visible y navegable pero CONGELADO por decisión de producto
 *               (WhatsApp/PixelBot en revisión de Meta; Finanzas): solo se
 *               integra en la navegación, sin cambios internos.
 * - `hidden`    fuera de toda superficie. Sus rutas responden 404 dentro del
 *               shell (guard `assertModuleRouteEnabled` en el `layout.tsx`
 *               del módulo, detrás del middleware de sesión). Código, rutas,
 *               tablas y datos siguen existiendo.
 * - `legacy`    igual que `hidden` y además superado por otro módulo
 *               (`supersededBy`).
 */

export type ModuleState = "active" | "protected" | "hidden" | "legacy";

export type ModuleId =
  // Navegación aprobada (WO-2026-00132, Funcional·Simple·Único):
  // Inicio · Clientes · WhatsApp · Finanzas · Blog · SEO · Trabajo ·
  // Cotizaciones · Usuarios
  | "inicio"
  | "clientes"
  | "whatsapp"
  | "finanzas"
  | "blog"
  | "seo"
  | "usuarios"
  | "proyectos"
  | "cotizaciones"
  // Controles globales (campana, menú de usuario) — no son dominios de navegación
  | "notificaciones"
  | "perfil"
  // Vistas sin entrada de navegación (se alcanzan por enlace contextual)
  | "smilemore-respuestas";
// WO-2026-00132: PixelForge, Definición, Marketing/Growth Suite completo
// (Contenido/Campañas/Calendario/Publicaciones/Brand Brain), Infraestructura,
// Plantillas, Documentos, Accesos (base de conocimiento del CRM) y el Blog
// legacy se BORRARON (código + esta entrada del registro) — ya no son
// "hidden", no existen. Antes vivían aquí ocultos y reactivables; esta vez
// Miguel pidió borrar de verdad, no ocultar.

export interface ModuleDefinition {
  id: ModuleId;
  /** Nombre humano del módulo (documentación, reportes). */
  label: string;
  state: ModuleState;
  /**
   * Rutas raíz que el módulo posee (prefijos de pathname). Se usan para el
   * guard de ruta (`layout.tsx` del módulo) y para resolver módulo por path.
   */
  routes: readonly string[];
  /** Módulo padre cuando la ruta está anidada (p. ej. definicion ⊂ proyectos). */
  parent?: ModuleId;
  /** Módulo que lo reemplaza (solo `legacy`). */
  supersededBy?: ModuleId;
  /** Decisión que fija el estado y cómo revertirla. */
  note: string;
}

const REGISTRY = [
  // ── Navegación aprobada ───────────────────────────────────────────────────
  {
    id: "inicio",
    label: "Inicio",
    state: "active",
    routes: ["/hoy"],
    note: "Etiqueta «Hoy» → «Inicio»; la ruta /hoy se conserva (orden §5).",
  },
  {
    id: "clientes",
    label: "Clientes",
    state: "active",
    routes: ["/clientes", "/clientes/leads"],
    note: "Solo información general, cuentas, requiere atención, notas y actividad reciente (orden §6). Las secciones ocultas del workspace viven en src/lib/modules/client-workspace.ts. WO-2026-00214 añade /clientes/leads (bandeja de demanda entrante; la tabla `leads` no tenía superficie en el panel).",
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    state: "protected",
    routes: ["/whatsapp"],
    note: "Congelado (revisión de Meta, orden §8). PixelBot (config del bot, Console) vive DENTRO de /whatsapp y se conserva exactamente ahí — excepción explícita.",
  },
  {
    id: "finanzas",
    label: "Finanzas",
    state: "protected",
    routes: ["/cobros"],
    note: "Visible y funcional exactamente como hoy (orden §7): solo integración de navegación.",
  },
  {
    id: "blog",
    label: "Blog",
    state: "active",
    routes: ["/blog-cms"],
    note: "Nueva sección Blog con paridad a Muebles Encino (orden §10, D-C Opción A): admin en /blog-cms (D-A del SG), misma tabla blog_posts que el legacy, público /blog de pixeltec.mx.",
  },
  {
    id: "seo",
    label: "SEO",
    state: "active",
    routes: ["/seo", "/seo/salud", "/seo/contenido", "/seo/llms", "/seo/robots", "/seo/local-business", "/seo/structured-data", "/seo/schema", "/seo/redes", "/seo/sitemap"],
    note: "Módulo SEO portado de Muebles Encino (WO-2026-00095, orden de Miguel 2026-08-26). Administra ÚNICAMENTE pixeltec.mx. Los ajustes viven en `app_settings` (migración 0044). WO-2026-00214 añade /seo/contenido (analítica y atribución de contenido, migración 0051).",
  },
  {
    id: "usuarios",
    label: "Usuarios",
    state: "active",
    routes: ["/usuarios"],
    note: "Parte del módulo conceptual «Usuarios y Accesos» (D-88-2): ruta /usuarios intacta.",
  },
  // ── Controles globales ────────────────────────────────────────────────────
  {
    id: "notificaciones",
    label: "Notificaciones",
    state: "active",
    routes: ["/notificaciones"],
    note: "Control global (campana), ADR-0030 §9. Sin cambios.",
  },
  {
    id: "perfil",
    label: "Perfil y seguridad",
    state: "active",
    routes: ["/perfil"],
    note: "Control global (menú de usuario), ADR-0030 §9. Sin cambios.",
  },
  {
    id: "smilemore-respuestas",
    label: "Respuestas Smile More",
    state: "active",
    routes: ["/smilemore-respuestas"],
    note: "Vista solo-admin sin entrada de navegación (se llega desde el aviso de WhatsApp). Sin cambios.",
  },
  {
    id: "proyectos",
    label: "Trabajo",
    state: "active",
    routes: ["/proyectos"],
    note: "WO-2026-00132: reemplaza Proyectos/Definición/PixelForge (borrados, no ocultos). Lista+detalle simple sobre la tabla `projects` real.",
  },
  {
    id: "cotizaciones",
    label: "Cotizaciones",
    state: "active",
    routes: ["/cotizaciones"],
    note: "WO-2026-00132: vista dedicada (vencidas/próximas a vencer) — antes solo se veían dentro de cada cliente.",
  },
] as const satisfies readonly ModuleDefinition[];

export const MODULES: readonly ModuleDefinition[] = REGISTRY;

const BY_ID = new Map<ModuleId, ModuleDefinition>(MODULES.map((m) => [m.id, m]));

export function getModule(id: ModuleId): ModuleDefinition {
  const m = BY_ID.get(id);
  if (!m) throw new Error(`Módulo no registrado: ${id}`);
  return m;
}

/** Estados que aparecen en las superficies de navegación. */
const VISIBLE_STATES: ReadonlySet<ModuleState> = new Set(["active", "protected"]);

/** `true` si el módulo debe mostrarse en alguna superficie de navegación. */
export function isModuleVisible(id: ModuleId): boolean {
  return VISIBLE_STATES.has(getModule(id).state);
}

/** Hijos directos de un módulo (rutas anidadas). */
export function getChildModules(id: ModuleId): ModuleDefinition[] {
  return MODULES.filter((m) => m.parent === id);
}

/**
 * `true` si las rutas del módulo deben servirse. Un módulo oculto cuyo hijo
 * está activo sigue sirviendo su árbol (el `layout.tsx` padre envuelve al
 * hijo); la página raíz del padre solo la protege su propio estado cuando no
 * hay hijos activos. Los estados `hidden`/`legacy` sin hijos activos ⇒ 404.
 */
export function isModuleRouteEnabled(id: ModuleId): boolean {
  if (isModuleVisible(id)) return true;
  return getChildModules(id).some((child) => isModuleRouteEnabled(child.id));
}

export function getModulesByState(state: ModuleState): ModuleDefinition[] {
  return MODULES.filter((m) => m.state === state);
}

/** Módulo dueño de un pathname (prefijo más largo), o undefined. */
export function getModuleForPath(pathname: string): ModuleDefinition | undefined {
  let best: { m: ModuleDefinition; len: number } | undefined;
  for (const m of MODULES) {
    for (const route of m.routes) {
      const matches = pathname === route || pathname.startsWith(`${route}/`);
      if (matches && (!best || route.length > best.len)) best = { m, len: route.length };
    }
  }
  return best?.m;
}
