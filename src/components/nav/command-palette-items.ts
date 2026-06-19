import {
  Sun,
  ListTodo,
  FolderKanban,
  Users,
  Receipt,
  KeyRound,
  Server,
  FileText,
  Settings2,
  Bitcoin,
  type LucideIcon,
} from "lucide-react";

export type NavSection = "nucleo" | "gestion" | "sistema";

export interface PaletteNavItem {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  section: NavSection;
  /** Items with hidden:true are excluded from sidebar and ⌘K palette (rendered in Week 2+). */
  hidden?: boolean;
}

/**
 * Single source of truth for all navigation items.
 * Ordered by section so consumers that iterate the array render
 * the same grouping as the desktop sidebar without extra logic.
 */
export const PALETTE_NAV_ITEMS: PaletteNavItem[] = [
  // ── Núcleo (trabajo diario) ───────────────────────────────────────────────
  {
    href: "/hoy",
    label: "Hoy",
    description: "Tareas del día, proyectos activos y actividad reciente de clientes",
    icon: Sun,
    section: "nucleo",
  },
  {
    href: "/tareas",
    label: "Tareas",
    description: "Lista maestra de tareas y vista semanal con planificador IA",
    icon: ListTodo,
    section: "nucleo",
  },
  {
    href: "/proyectos",
    label: "Proyectos",
    description: "Estado por proyecto, kanban de tareas y entregas",
    icon: FolderKanban,
    section: "nucleo",
  },
  {
    href: "/clientes",
    label: "Clientes",
    description: "Directorio de cuentas activas, portal y actualizaciones",
    icon: Users,
    section: "nucleo",
  },
  // ── Gestión (ciclo operativo) ─────────────────────────────────────────────
  {
    href: "/cobros",
    label: "Cobros",
    description: "Facturas, pagos pendientes y cobros por cliente",
    icon: Receipt,
    section: "gestion",
  },
  {
    href: "/accesos",
    label: "Conocimiento",
    description: "Base de conocimiento, tips y documentación técnica",
    icon: KeyRound,
    section: "gestion",
  },
  {
    href: "/crypto-intel",
    label: "Crypto Intel",
    description: "Precios y alertas de mercado en tiempo real",
    icon: Bitcoin,
    section: "gestion",
    hidden: true,
  },
  // ── Sistema (colapsado por defecto) ──────────────────────────────────────
  {
    href: "/vps",
    label: "Infraestructura",
    description: "VPS status, deploys y monitoreo",
    icon: Server,
    section: "sistema",
  },
  {
    href: "/blog-admin",
    label: "Blog",
    description: "Gestión de posts, borradores y pipeline de contenido",
    icon: FileText,
    section: "sistema",
  },
  {
    href: "/perfil",
    label: "Configuración",
    description: "Perfil, notificaciones y preferencias del sistema",
    icon: Settings2,
    section: "sistema",
  },
];

export const NAV_SECTION_ORDER: NavSection[] = ["nucleo", "gestion", "sistema"];

export const NAV_SECTION_LABELS: Record<NavSection, string> = {
  nucleo: "Núcleo",
  gestion: "Gestión",
  sistema: "Sistema",
};

export const MAX_RECENT_ROUTES = 5;
export const RECENT_ROUTES_KEY = "pixeltec_recent_routes";

/**
 * Look up the display label for a nav route by its href.
 * Returns the href itself as a fallback so callers never get undefined.
 */
export function getNavLabel(href: string): string {
  return PALETTE_NAV_ITEMS.find((item) => item.href === href)?.label ?? href;
}
