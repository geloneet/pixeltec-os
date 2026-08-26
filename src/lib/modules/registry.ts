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
  // Navegación aprobada (orden visible: Inicio · Clientes · WhatsApp · Finanzas · Blog · Usuarios y Accesos)
  | "inicio"
  | "clientes"
  | "whatsapp"
  | "finanzas"
  | "blog"
  | "usuarios"
  | "accesos"
  // Controles globales (campana, menú de usuario) — no son dominios de navegación
  | "notificaciones"
  | "perfil"
  // Vistas sin entrada de navegación (se alcanzan por enlace contextual)
  | "smilemore-respuestas"
  // Ocultos por la limpieza (reactivables)
  | "proyectos"
  | "definicion"
  | "pixelforge"
  | "marketing"
  | "contenido"
  | "campanas"
  | "calendario"
  | "publicaciones"
  | "brand-brain"
  | "infraestructura"
  | "plantillas"
  | "documentos"
  // Legacy (superado)
  | "blog-legacy";

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
    routes: ["/clientes"],
    note: "Solo información general, cuentas, requiere atención, notas y actividad reciente (orden §6). Las secciones ocultas del workspace viven en src/lib/modules/client-workspace.ts.",
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
    id: "usuarios",
    label: "Usuarios",
    state: "active",
    routes: ["/usuarios"],
    note: "Parte del módulo conceptual «Usuarios y Accesos» (D-88-2): ruta /usuarios intacta.",
  },
  {
    id: "accesos",
    label: "Accesos",
    state: "hidden",
    routes: ["/accesos"],
    note: "Base de conocimiento del CRM (tools + knowledge_tips). OCULTO por orden de Miguel (2026-08-26): el criterio 2 de WO-2026-00088 ya pedía que «Conocimiento» no apareciera en ninguna superficie; se había retirado solo la etiqueta y la sección seguía visible como «Accesos». Código, ruta, tablas y datos intactos: reactivar = state «active».",
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
  // ── Ocultos (orden §3.8) ──────────────────────────────────────────────────
  {
    id: "proyectos",
    label: "Trabajo / Proyectos",
    state: "hidden",
    routes: ["/proyectos"],
    note: "Oculto (orden §3.8: Proyectos, Trabajo). Reactivar: state → active.",
  },
  {
    id: "definicion",
    label: "Definición de proyectos",
    state: "hidden",
    routes: ["/proyectos/definicion"],
    parent: "proyectos",
    note: "Oculto (orden §3.8: Definición).",
  },
  {
    id: "pixelforge",
    label: "PixelForge",
    state: "hidden",
    routes: ["/proyectos/pixelforge"],
    parent: "proyectos",
    note: "Oculto (módulo no aprobado expresamente). El preview embebido con token pfqa vive en otro route group y no depende de este guard.",
  },
  {
    id: "marketing",
    label: "Marketing (resumen)",
    state: "hidden",
    routes: ["/crecimiento"],
    note: "Oculto (orden §3.8: Marketing).",
  },
  {
    id: "contenido",
    label: "Contenido (Content Studio)",
    state: "hidden",
    routes: ["/crecimiento/content-studio"],
    parent: "marketing",
    note: "Oculto (orden §3.8: Contenido).",
  },
  {
    id: "campanas",
    label: "Campañas",
    state: "hidden",
    routes: ["/crecimiento/campanas"],
    parent: "marketing",
    note: "Oculto (módulo no aprobado expresamente).",
  },
  {
    id: "calendario",
    label: "Calendario",
    state: "hidden",
    routes: ["/crecimiento/calendario"],
    parent: "marketing",
    note: "Oculto (módulo no aprobado expresamente).",
  },
  {
    id: "publicaciones",
    label: "Publicaciones (Publisher)",
    state: "hidden",
    routes: ["/crecimiento/publisher"],
    parent: "marketing",
    note: "Oculto, NO eliminado (orden §9). El flujo del token de redes se conserva documentado en docs/publicaciones-token-redes.md con checklist de reactivación.",
  },
  {
    id: "brand-brain",
    label: "Configuración de marca (Brand Brain)",
    state: "hidden",
    routes: ["/crecimiento/brand-brain"],
    parent: "marketing",
    note: "Oculto (módulo no aprobado expresamente).",
  },
  {
    id: "infraestructura",
    label: "Infraestructura (VPS)",
    state: "hidden",
    routes: ["/vps"],
    note: "Oculto (orden §3.8: Infraestructura).",
  },
  {
    id: "plantillas",
    label: "Plantillas (Centro IA)",
    state: "hidden",
    routes: ["/ia-factory"],
    note: "Oculto (orden §3.8: Plantillas).",
  },
  {
    id: "documentos",
    label: "Archivo documental",
    state: "hidden",
    routes: ["/documentos"],
    note: "Oculto (módulo no aprobado expresamente; WO acceptance «Documentos»).",
  },
  // ── Legacy ────────────────────────────────────────────────────────────────
  {
    id: "blog-legacy",
    label: "Blog anterior (blog-admin)",
    state: "legacy",
    routes: ["/blog-admin"],
    supersededBy: "blog",
    note: "Oculto (orden §3.8: Blog anterior/legacy). Superado por la nueva sección Blog; código, tablas y el blog público de pixeltec.mx siguen intactos.",
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
