import {
  FolderKanban,
  Users,
  ListChecks,
  Flame,
  Clock3,
  KeyRound,
  Receipt,
  Server,
  type LucideIcon,
} from "lucide-react";
import { isModuleVisible, type ModuleId } from "@/lib/modules/registry";
import type { TodayStats } from "@/lib/hoy/types";

/**
 * Superficie de /hoy («Inicio») declarada por módulo (WO-2026-00088): cada
 * acceso rápido, KPI y widget pertenece a un módulo del registro central y
 * solo se renderiza si ese módulo es visible. Reactivar un módulo devuelve sus
 * tarjetas sin tocar la página.
 */
export interface InicioQuickAction {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
  module: ModuleId;
}

/** Accesos rápidos — rutas reales del catálogo de navegación (nav-config.ts). */
export const INICIO_QUICK_ACTIONS: readonly InicioQuickAction[] = [
  {
    icon: FolderKanban,
    title: "Proyectos",
    description: "Vista maestra de todos los proyectos",
    href: "/proyectos",
    module: "proyectos",
  },
  {
    icon: Users,
    title: "Clientes",
    description: "Cuentas, seguimiento y notas",
    href: "/clientes",
    module: "clientes",
  },
  {
    icon: Receipt,
    title: "Cobros",
    description: "Cobros recurrentes y vencimientos",
    href: "/cobros",
    module: "finanzas",
  },
  {
    icon: Server,
    title: "Infraestructura",
    description: "Estado del VPS y deploys",
    href: "/vps",
    module: "infraestructura",
  },
];

export interface InicioStatCard {
  key: keyof TodayStats;
  icon: LucideIcon;
  label: string;
  module: ModuleId;
  format: (stats: TodayStats) => string;
}

export const INICIO_STAT_CARDS: readonly InicioStatCard[] = [
  { key: "activeProjects", icon: FolderKanban, label: "Proyectos activos", module: "proyectos", format: (s) => String(s.activeProjects) },
  { key: "clients", icon: Users, label: "Clientes", module: "clientes", format: (s) => String(s.clients) },
  { key: "openTasks", icon: ListChecks, label: "Tareas abiertas", module: "proyectos", format: (s) => String(s.openTasks) },
  { key: "streak", icon: Flame, label: "Racha", module: "clientes", format: (s) => `${s.streak}d` },
  { key: "sessions", icon: Clock3, label: "Sesiones", module: "proyectos", format: (s) => String(s.sessions) },
  { key: "tools", icon: KeyRound, label: "Accesos", module: "accesos", format: (s) => String(s.tools) },
];

/** Widgets (paneles) de Inicio y el módulo al que pertenecen. */
export const INICIO_WIDGETS = {
  activityChart: "proyectos",
  activeProjects: "proyectos",
  recentClients: "clientes",
} as const satisfies Record<string, ModuleId>;

export type InicioWidget = keyof typeof INICIO_WIDGETS;

export function getVisibleQuickActions(): InicioQuickAction[] {
  return INICIO_QUICK_ACTIONS.filter((a) => isModuleVisible(a.module));
}

export function getVisibleStatCards(): InicioStatCard[] {
  return INICIO_STAT_CARDS.filter((c) => isModuleVisible(c.module));
}

export function isInicioWidgetVisible(widget: InicioWidget): boolean {
  return isModuleVisible(INICIO_WIDGETS[widget]);
}
