import { PALETTE_NAV_ITEMS, type PaletteNavItem } from "./command-palette-items";
import { isRestrictedRole, REVIEWER_PAGE_ROOT } from "@/lib/routes/reviewer-access";
import { isModuleVisible } from "@/lib/modules/registry";

/**
 * Taxonomía operativa de la navegación (ADR-0030, ADR-0039). Las áreas L1
 * representan dominios del ciclo de negocio, no tecnologías. Los slugs
 * internos se conservan por estabilidad (crm/proyectos/infra); la etiqueta
 * visible vive en NAV_AREA_LABELS.
 *
 * WO-2026-00088 (ADR-0054 propuesta): la navegación visible queda en
 * Inicio · Clientes · WhatsApp · Finanzas · Blog · Usuarios y Accesos. Las
 * áreas y destinos de los módulos ocultos se CONSERVAN en este catálogo; su
 * visibilidad la decide el registro central (`src/lib/modules/registry.ts`):
 * un área se muestra solo si tiene al menos un destino de un módulo visible.
 */
export type NavArea =
  | "hoy"
  | "crm"
  | "whatsapp"
  | "finanzas"
  | "blog"
  | "usuarios"
  | "proyectos"
  | "marketing"
  | "infra";

/** Orden completo (visibles primero, en el orden aprobado; ocultas después). */
export const NAV_AREA_ORDER: NavArea[] = [
  "hoy",
  "crm",
  "whatsapp",
  "finanzas",
  "blog",
  "usuarios",
  "proyectos",
  "marketing",
  "infra",
];

export const NAV_AREA_LABELS: Record<NavArea, string> = {
  hoy: "Inicio",
  crm: "Clientes",
  whatsapp: "WhatsApp",
  finanzas: "Finanzas",
  blog: "Blog",
  usuarios: "Usuarios y Accesos",
  proyectos: "Trabajo",
  marketing: "Marketing",
  infra: "Sistema",
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
  crm: [{ href: "/clientes" }],
  // PixelBot conserva su acceso actual (item "PixelBot" → /whatsapp) dentro
  // del área WhatsApp: excepción explícita de la orden (§3.3).
  whatsapp: [{ href: "/whatsapp" }],
  finanzas: [{ href: "/cobros" }],
  // Las rutas del Blog nuevo se registran en FASE 8 de WO-2026-00088.
  blog: [],
  usuarios: [{ href: "/usuarios" }, { href: "/accesos" }],
  proyectos: [
    { href: "/proyectos" },
    { href: "/proyectos/definicion", secondaryLabel: "Definición" },
    { href: "/proyectos/pixelforge" },
  ],
  marketing: [
    { href: "/crecimiento", secondaryLabel: "Resumen" },
    { href: "/blog-admin" },
    { href: "/crecimiento/content-studio" },
    { href: "/crecimiento/campanas" },
    { href: "/crecimiento/calendario" },
    { href: "/crecimiento/publisher" },
    { href: "/crecimiento/brand-brain", navHidden: true },
  ],
  infra: [{ href: "/vps" }, { href: "/ia-factory" }],
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

export function getVisibleNavItems(role: string | undefined): PaletteNavItem[] {
  const visible = getVisibleCatalog();
  if (role === undefined) return visible;
  return isRestrictedRole(role)
    ? visible.filter((item) => item.href === REVIEWER_PAGE_ROOT)
    : visible;
}
