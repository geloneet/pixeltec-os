import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Wrench,
  Server,
  Bitcoin,
  FileText,
  History,
  type LucideIcon,
} from "lucide-react";

export type NavSection = "operacion" | "negocio" | "infra" | "sistema";

export interface PaletteNavItem {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  section: NavSection;
}

/**
 * Items ordered by section so consumers that simply iterate the array
 * (command palette, mobile menu, etc.) render the same grouping as the
 * desktop sidebar without any extra logic.
 */
export const PALETTE_NAV_ITEMS: PaletteNavItem[] = [
  // ── Operación ────────────────────────────────────────────────────────────
  {
    href: "/hoy",
    label: "Hoy",
    description: "Tareas pendientes y agenda del día",
    icon: CalendarDays,
    section: "operacion",
  },
  {
    href: "/asistente/historial",
    label: "Historial — Asistente",
    description: "Timeline de semanas archivadas con drill-down y KPIs",
    icon: History,
    section: "operacion",
  },
  // ── Negocio ──────────────────────────────────────────────────────────────
  {
    href: "/clientes",
    label: "Clientes",
    description: "Gestión de clientes y pipeline comercial",
    icon: Users,
    section: "negocio",
  },
  {
    href: "/blog-admin",
    label: "Blog Admin",
    description: "Gestión de posts, borradores y pipeline de contenido",
    icon: FileText,
    section: "negocio",
  },
  // ── Infra ────────────────────────────────────────────────────────────────
  {
    href: "/vps",
    label: "VPS / DevOps",
    description: "Infraestructura VPS, deploys y monitoreo",
    icon: Server,
    section: "infra",
  },
  {
    href: "/crypto-intel",
    label: "Crypto Intel",
    description: "Precios y alertas de mercado en tiempo real",
    icon: Bitcoin,
    section: "infra",
  },
  // ── Sistema ──────────────────────────────────────────────────────────────
  {
    href: "/dashboard",
    label: "Dashboard",
    description: "Centro de control de PixelTEC OS",
    icon: LayoutDashboard,
    section: "sistema",
  },
  {
    href: "/herramientas",
    label: "Herramientas",
    description: "Credenciales, prompts y documentación interna",
    icon: Wrench,
    section: "sistema",
  },
];

export const NAV_SECTION_ORDER: NavSection[] = [
  "operacion",
  "negocio",
  "infra",
  "sistema",
];

export const NAV_SECTION_LABELS: Record<NavSection, string> = {
  operacion: "Operación",
  negocio: "Negocio",
  infra: "Infra",
  sistema: "Sistema",
};

export const MAX_RECENT_ROUTES = 5;
export const RECENT_ROUTES_KEY = "pixeltec_recent_routes";
