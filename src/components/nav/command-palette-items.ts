import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Wrench,
  Server,
  Bitcoin,
  type LucideIcon,
} from "lucide-react";

export interface PaletteNavItem {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

export const PALETTE_NAV_ITEMS: PaletteNavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    description: "Centro de control de PixelTEC OS",
    icon: LayoutDashboard,
  },
  {
    href: "/hoy",
    label: "Hoy",
    description: "Tareas pendientes y agenda del día",
    icon: CalendarDays,
  },
  {
    href: "/clientes",
    label: "Clientes",
    description: "Gestión de clientes y pipeline comercial",
    icon: Users,
  },
  {
    href: "/herramientas",
    label: "Herramientas",
    description: "Credenciales, prompts y documentación interna",
    icon: Wrench,
  },
  {
    href: "/vps",
    label: "DevOps",
    description: "Infraestructura VPS, deploys y monitoreo",
    icon: Server,
  },
  {
    href: "/crypto-intel",
    label: "Crypto Intel",
    description: "Precios y alertas de mercado en tiempo real",
    icon: Bitcoin,
  },
];

export const MAX_RECENT_ROUTES = 5;
export const RECENT_ROUTES_KEY = "pixeltec_recent_routes";
