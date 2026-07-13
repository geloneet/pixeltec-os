import { PALETTE_NAV_ITEMS, type PaletteNavItem } from "./command-palette-items";

/**
 * Product-level taxonomy for the Top Navigation (L1 pills). Replaces the old
 * operational grouping (Trabajo/Finanzas/Producción/Sistema/Crecimiento) that
 * lived only in the (now removed) DesktopSidebar.
 */
export type NavArea =
  | "hoy"
  | "crm"
  | "proyectos"
  | "finanzas"
  | "ia"
  | "marketing"
  | "infra";

export const NAV_AREA_ORDER: NavArea[] = [
  "hoy",
  "crm",
  "proyectos",
  "finanzas",
  "ia",
  "marketing",
  "infra",
];

export const NAV_AREA_LABELS: Record<NavArea, string> = {
  hoy: "Hoy",
  crm: "CRM",
  proyectos: "Proyectos",
  finanzas: "Finanzas",
  ia: "IA",
  marketing: "Marketing",
  infra: "Infra",
};

interface AreaItemRef {
  href: string;
  /**
   * Overrides `item.label` when rendered in the secondary nav, to avoid
   * repeating the L1 pill's word (e.g. area "Proyectos" → item "Todos"
   * instead of "Proyectos").
   */
  secondaryLabel?: string;
}

/**
 * Nivel 2: qué sub-rutas cuelgan de cada área y en qué orden se muestran.
 * Solo referencia hrefs que YA existen como rutas reales — no se inventan
 * páginas nuevas ni se refactorizan los tabs internos de CRM/Proyectos.
 */
const AREA_ITEMS: Record<NavArea, AreaItemRef[]> = {
  hoy: [{ href: "/hoy" }],
  crm: [
    { href: "/clientes" },
    { href: "/whatsapp" },
  ],
  proyectos: [
    { href: "/proyectos", secondaryLabel: "Todos" },
    { href: "/proyectos/definicion", secondaryLabel: "Definición" },
    { href: "/tareas" },
  ],
  finanzas: [{ href: "/cobros" }, { href: "/documentos" }],
  ia: [
    { href: "/ia-factory", secondaryLabel: "Centro IA" },
    { href: "/accesos" },
  ],
  marketing: [
    { href: "/crecimiento/brand-brain" },
    { href: "/crecimiento/content-studio" },
    { href: "/crecimiento/campanas" },
    { href: "/crecimiento/calendario" },
    { href: "/crecimiento/publisher" },
  ],
  infra: [
    { href: "/vps", secondaryLabel: "Infraestructura" },
    { href: "/blog-admin", secondaryLabel: "Blog" },
    { href: "/perfil", secondaryLabel: "Configuración" },
  ],
};

/** Lookup href → area, derivado de AREA_ITEMS (una sola fuente de verdad). */
const HREF_TO_AREA = new Map<string, NavArea>();
for (const area of NAV_AREA_ORDER) {
  for (const ref of AREA_ITEMS[area]) HREF_TO_AREA.set(ref.href, area);
}

export function getItemArea(href: string): NavArea | undefined {
  return HREF_TO_AREA.get(href);
}

/** Href al que apunta el pill L1 de un área (el primer sub-módulo). */
export function getAreaHref(area: NavArea): string {
  return AREA_ITEMS[area][0]?.href ?? "/hoy";
}

export interface SecondaryNavItem extends PaletteNavItem {
  secondaryLabel: string;
}

/** Sub-módulos visibles (nivel 2) de un área, en el orden definido arriba. */
export function getSecondaryItems(area: NavArea): SecondaryNavItem[] {
  return AREA_ITEMS[area]
    .map((ref) => {
      const item = PALETTE_NAV_ITEMS.find((i) => i.href === ref.href);
      if (!item || item.hidden) return null;
      return { ...item, secondaryLabel: ref.secondaryLabel ?? item.label };
    })
    .filter((i): i is SecondaryNavItem => !!i);
}

/**
 * Items que no cuelgan de ninguna área visible: catálogo marcado `hidden`
 * (Crypto Intel, Analytics) más rutas de acceso directo (Notificaciones).
 * Se muestran únicamente en el menú desplegable "Más…" de la Top Navigation.
 */
export const OVERFLOW_ITEMS: PaletteNavItem[] = PALETTE_NAV_ITEMS.filter(
  (item) => item.hidden
);

/**
 * Resolves which single href in the catalog should light up for a given
 * pathname. Longest-prefix-wins so a parent route (e.g. /proyectos) doesn't
 * fight an active sub-route (/proyectos/123). Moved here from the (now
 * removed) desktop-sidebar.tsx.
 */
export function resolveActiveHref(
  items: PaletteNavItem[],
  pathname: string
): string | null {
  let best: { href: string; length: number } | null = null;
  for (const item of items) {
    if (item.href === "/dashboard") {
      if (pathname === item.href) return item.href;
      continue;
    }
    const matches =
      pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (matches && (!best || item.href.length > best.length)) {
      best = { href: item.href, length: item.href.length };
    }
  }
  return best?.href ?? null;
}

export function getActiveItem(pathname: string): PaletteNavItem | null {
  const href = resolveActiveHref(PALETTE_NAV_ITEMS, pathname);
  return PALETTE_NAV_ITEMS.find((i) => i.href === href) ?? null;
}

/** Área activa para el pathname actual, o null si no hay match o si el
 * item activo es un item "Más…" (hidden). */
export function getActiveArea(pathname: string): NavArea | null {
  const item = getActiveItem(pathname);
  if (!item || item.hidden) return null;
  return getItemArea(item.href) ?? null;
}
