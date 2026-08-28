import {
  FolderKanban,
  Users,
  Receipt,
  FileClock,
  type LucideIcon,
} from "lucide-react";
import { isModuleVisible, type ModuleId } from "@/lib/modules/registry";
import type { TodayStats } from "@/lib/hoy/types";

/**
 * Superficie de /hoy («Inicio») — WO-2026-00132: vistazo puramente comercial
 * (leads, cotizaciones, proyectos, clientes). Se retiraron los accesos/KPIs
 * de infraestructura, sesiones de trabajo y "Accesos" (WO-2026-00088 los
 * ocultaba; esta vez el módulo entero se borró). Cada acceso rápido y KPI
 * sigue perteneciendo a un módulo del registro central: solo se renderiza si
 * ese módulo es visible.
 */
export interface InicioQuickAction {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
  module: ModuleId;
}

export const INICIO_QUICK_ACTIONS: readonly InicioQuickAction[] = [
  {
    icon: Users,
    title: "Clientes",
    description: "Cuentas, seguimiento y notas",
    href: "/clientes",
    module: "clientes",
  },
  {
    icon: Receipt,
    title: "Cotizaciones",
    description: "Vencidas, próximas a vencer y el resto",
    href: "/cotizaciones",
    module: "cotizaciones",
  },
  {
    icon: FolderKanban,
    title: "Trabajo",
    description: "Proyectos realizados y pendientes",
    href: "/proyectos",
    module: "proyectos",
  },
  {
    icon: FileClock,
    title: "Cobros",
    description: "Cobros recurrentes y vencimientos",
    href: "/cobros",
    module: "finanzas",
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
  { key: "clients", icon: Users, label: "Clientes", module: "clientes", format: (s) => String(s.clients) },
  { key: "activeProjects", icon: FolderKanban, label: "Proyectos en curso", module: "proyectos", format: (s) => String(s.activeProjects) },
  { key: "pendingQuotes", icon: Receipt, label: "Cotizaciones pendientes", module: "cotizaciones", format: (s) => String(s.pendingQuotes) },
  { key: "expiringQuotes", icon: FileClock, label: "Próximas a vencer", module: "cotizaciones", format: (s) => String(s.expiringQuotes) },
];

/** Widgets (paneles) de Inicio y el módulo al que pertenecen. */
export const INICIO_WIDGETS = {
  recentProjects: "proyectos",
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
