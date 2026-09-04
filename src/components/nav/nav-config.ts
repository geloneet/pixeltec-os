import { PALETTE_NAV_ITEMS, type PaletteNavItem } from "./command-palette-items";
import { isRestrictedRole, REVIEWER_PAGE_ROOT } from "@/lib/routes/reviewer-access";
import { isModuleVisible } from "@/lib/modules/registry";
import type { CRMClient, CRMTask } from "@/types/crm";

/**
 * Taxonomía operativa de la navegación (ADR-0030, ADR-0039). Las áreas L1
 * representan dominios del ciclo de negocio, no tecnologías. Los slugs
 * internos se conservan por estabilidad; la etiqueta visible vive en
 * NAV_AREA_LABELS.
 *
 * WO-2026-00132 (Funcional·Simple·Único): nav = Inicio · Clientes ·
 * WhatsApp · Finanzas · Cotizaciones · Trabajo · Blog · SEO · Usuarios.
 * Marketing e Infraestructura se BORRARON (código y área), no se ocultan.
 */
export type NavArea =
  | "hoy"
  | "crm"
  | "whatsapp"
  | "finanzas"
  | "cotizaciones"
  | "proyectos"
  | "blog"
  | "usuarios"
  | "seo";

/** Orden completo. */
export const NAV_AREA_ORDER: NavArea[] = [
  "hoy",
  "crm",
  "whatsapp",
  "finanzas",
  "cotizaciones",
  "proyectos",
  "blog",
  "seo",
  "usuarios",
];

export const NAV_AREA_LABELS: Record<NavArea, string> = {
  hoy: "Inicio",
  crm: "Clientes",
  whatsapp: "WhatsApp",
  finanzas: "Finanzas",
  cotizaciones: "Cotizaciones",
  proyectos: "Trabajo",
  blog: "Blog",
  seo: "SEO",
  usuarios: "Usuarios",
};

interface AreaItemRef {
  href: string;
  /**
   * Overrides `item.label` cuando se renderiza en la secondary nav
   * (p.ej. "Resumen" en vez de "Resumen de marketing").
   */
  secondaryLabel?: string;
  /**
   * Pertenece al área (agrupación en ⌘K y pill activa) pero no se muestra
   * como tab de la secondary nav — p.ej. Configuración de marca, accesible
   * desde Marketing → Resumen y ⌘K (ADR-0030 §10).
   */
  navHidden?: boolean;
}

/**
 * Nivel 2: qué sub-rutas cuelgan de cada área y en qué orden se muestran.
 * Solo referencia hrefs que YA existen como rutas reales — no se inventan
 * páginas nuevas ni se refactorizan los tabs internos de CRM/Proyectos.
 * Las rutas transversales (/documentos, /notificaciones, /perfil) viven fuera
 * de toda área: campana, menú de usuario, enlaces contextuales y ⌘K.
 */
const AREA_ITEMS: Record<NavArea, AreaItemRef[]> = {
  hoy: [{ href: "/hoy" }],
  crm: [
    { href: "/clientes", secondaryLabel: "Cuentas" },
    { href: "/clientes/leads", secondaryLabel: "Leads" },
  ],
  // PixelBot conserva su acceso actual (item "PixelBot" → /whatsapp) dentro
  // del área WhatsApp: excepción explícita de la orden (§3.3).
  whatsapp: [{ href: "/whatsapp" }],
  finanzas: [{ href: "/cobros" }],
  blog: [{ href: "/blog-cms" }],
  seo: [
    { href: "/seo/salud", secondaryLabel: "Salud" },
    { href: "/seo/contenido", secondaryLabel: "Contenido" },
    { href: "/seo/llms" },
    { href: "/seo/robots" },
    { href: "/seo/local-business", secondaryLabel: "Negocio local" },
    { href: "/seo/structured-data", secondaryLabel: "Datos estructurados" },
    { href: "/seo/schema", secondaryLabel: "Schema por página" },
    { href: "/seo/redes", secondaryLabel: "Redes" },
    { href: "/seo/sitemap", secondaryLabel: "Sitemap" },
  ],
  usuarios: [{ href: "/usuarios" }],
  proyectos: [{ href: "/proyectos" }],
  cotizaciones: [{ href: "/cotizaciones" }],
};

/** Lookup href → area, derivado de AREA_ITEMS (una sola fuente de verdad). */
const HREF_TO_AREA = new Map<string, NavArea>();
for (const area of NAV_AREA_ORDER) {
  for (const ref of AREA_ITEMS[area]) HREF_TO_AREA.set(ref.href, area);
}

export function getItemArea(href: string): NavArea | undefined {
  return HREF_TO_AREA.get(href);
}

/** Destino del catálogo visible según el registro de módulos. */
export function isNavItemVisible(item: PaletteNavItem): boolean {
  return isModuleVisible(item.module);
}

/** Catálogo completo filtrado por el registro (sin considerar el rol). */
export function getVisibleCatalog(): PaletteNavItem[] {
  return PALETTE_NAV_ITEMS.filter(isNavItemVisible);
}

function areaItems(area: NavArea): Array<{ ref: AreaItemRef; item: PaletteNavItem }> {
  return AREA_ITEMS[area]
    .map((ref) => {
      const item = PALETTE_NAV_ITEMS.find((i) => i.href === ref.href);
      return item && isNavItemVisible(item) ? { ref, item } : null;
    })
    .filter((x): x is { ref: AreaItemRef; item: PaletteNavItem } => x !== null);
}

/** `true` si el área tiene al menos un destino de un módulo visible. */
export function isAreaVisible(area: NavArea): boolean {
  return areaItems(area).length > 0;
}

/** Href al que apunta el pill L1 de un área (el primer sub-módulo visible). */
export function getAreaHref(area: NavArea): string {
  return areaItems(area)[0]?.item.href ?? "/hoy";
}

export interface SecondaryNavItem extends PaletteNavItem {
  secondaryLabel: string;
}

/** Sub-módulos visibles (nivel 2) de un área, en el orden definido arriba. */
export function getSecondaryItems(area: NavArea): SecondaryNavItem[] {
  return areaItems(area)
    .filter(({ ref }) => !ref.navHidden)
    .map(({ ref, item }) => ({ ...item, secondaryLabel: ref.secondaryLabel ?? item.label }));
}

/**
 * Resolves which single href in the catalog should light up for a given
 * pathname. Longest-prefix-wins so a parent route (e.g. /proyectos) doesn't
 * fight an active sub-route (/proyectos/123).
 */
export function resolveActiveHref(
  items: PaletteNavItem[],
  pathname: string
): string | null {
  let best: { href: string; length: number } | null = null;
  for (const item of items) {
    const matches =
      pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (matches && (!best || item.href.length > best.length)) {
      best = { href: item.href, length: item.href.length };
    }
  }
  return best?.href ?? null;
}

/** Item activo para el pathname — solo entre destinos visibles. */
export function getActiveItem(pathname: string): PaletteNavItem | null {
  const visible = getVisibleCatalog();
  const href = resolveActiveHref(visible, pathname);
  return visible.find((i) => i.href === href) ?? null;
}

/** Área activa para el pathname actual, o null si no hay match (las rutas
 * transversales como /notificaciones o /perfil, y las rutas de módulos
 * ocultos, no encienden pill). */
export function getActiveArea(pathname: string): NavArea | null {
  const item = getActiveItem(pathname);
  if (!item) return null;
  return getItemArea(item.href) ?? null;
}

/**
 * Navegación visible para un rol (WO-2026-00051). PRESENTACIÓN solamente: el
 * enforcement vive en src/middleware.ts + guards; ocultar un enlace no
 * protege nada. El reviewer solo ve WhatsApp; admin y staff ven las áreas con
 * módulos visibles en el registro.
 *
 * `role === undefined` (sesión aún cargando) se trata como acceso completo
 * para no parpadear el menú de admin/staff; el middleware sigue mandando.
 */
export function getVisibleNavAreas(role: string | undefined): NavArea[] {
  const areas = NAV_AREA_ORDER.filter(isAreaVisible);
  if (role === undefined) return areas;
  return isRestrictedRole(role) ? [] : areas;
}

/**
 * Estados de tarea que cuentan como «abierta» para el badge del área Trabajo.
 * Vivía duplicado literal en `app-sidebar.tsx` y `top-navigation.tsx`: los dos
 * renderizan el MISMO número (desktop y mobile), así que dos copias solo podían
 * divergir.
 */
const OPEN_TASK_STATUSES: ReadonlySet<CRMTask["status"]> = new Set([
  "pendiente",
  "en_progreso",
  "en_revision",
]);

/** Tareas abiertas en todos los proyectos de todos los clientes. */
export function countOpenTasks(clients: CRMClient[]): number {
  return clients
    .flatMap((c) => c.projects)
    .flatMap((p) => p.tasks)
    .filter((t) => OPEN_TASK_STATUSES.has(t.status)).length;
}

export function getVisibleNavItems(role: string | undefined): PaletteNavItem[] {
  const visible = getVisibleCatalog();
  if (role === undefined) return visible;
  return isRestrictedRole(role)
    ? visible.filter((item) => item.href === REVIEWER_PAGE_ROOT)
    : visible;
}
