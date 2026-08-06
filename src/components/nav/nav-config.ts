import { PALETTE_NAV_ITEMS, type PaletteNavItem } from "./command-palette-items";

/**
 * Taxonomía operativa de la navegación (ADR-0030): las áreas L1 representan
 * dominios del ciclo de negocio (demanda → venta → cliente → trabajo → cobro →
 * soporte → crecimiento), no tecnologías. Los slugs internos se conservan por
 * estabilidad (crm/proyectos/infra); la etiqueta visible vive en NAV_AREA_LABELS.
 */
export type NavArea =
  | "hoy"
  | "proyectos"
  | "crm"
  | "finanzas"
  | "marketing"
  | "infra";

export const NAV_AREA_ORDER: NavArea[] = [
  "hoy",
  "proyectos",
  "crm",
  "finanzas",
  "marketing",
  "infra",
];

export const NAV_AREA_LABELS: Record<NavArea, string> = {
  hoy: "Hoy",
  proyectos: "Trabajo",
  crm: "Clientes",
  finanzas: "Finanzas",
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
  proyectos: [
    { href: "/proyectos" },
    { href: "/proyectos/definicion", secondaryLabel: "Definición" },
    { href: "/proyectos/pixelforge" },
  ],
  crm: [
    { href: "/clientes" },
    { href: "/whatsapp" },
  ],
  finanzas: [{ href: "/cobros" }],
  marketing: [
    { href: "/crecimiento", secondaryLabel: "Resumen" },
    { href: "/blog-admin" },
    { href: "/crecimiento/content-studio" },
    { href: "/crecimiento/campanas" },
    { href: "/crecimiento/calendario" },
    { href: "/crecimiento/publisher" },
    { href: "/crecimiento/brand-brain", navHidden: true },
  ],
  infra: [
    { href: "/vps" },
    { href: "/accesos" },
    { href: "/ia-factory" },
    // C-PR5: administración del equipo interno (solo admins — la página
    // rebota a /hoy y cada action pasa por requireAdmin). L2 permitido;
    // la L1 queda intacta (ADR-0030).
    { href: "/usuarios" },
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
    .filter((ref) => !ref.navHidden)
    .map((ref) => {
      const item = PALETTE_NAV_ITEMS.find((i) => i.href === ref.href);
      if (!item) return null;
      return { ...item, secondaryLabel: ref.secondaryLabel ?? item.label };
    })
    .filter((i): i is SecondaryNavItem => !!i);
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

export function getActiveItem(pathname: string): PaletteNavItem | null {
  const href = resolveActiveHref(PALETTE_NAV_ITEMS, pathname);
  return PALETTE_NAV_ITEMS.find((i) => i.href === href) ?? null;
}

/** Área activa para el pathname actual, o null si no hay match (las rutas
 * transversales como /documentos, /notificaciones o /perfil no encienden pill). */
export function getActiveArea(pathname: string): NavArea | null {
  const item = getActiveItem(pathname);
  if (!item) return null;
  return getItemArea(item.href) ?? null;
}
