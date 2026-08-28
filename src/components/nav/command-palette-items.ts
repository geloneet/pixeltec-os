import {
  Sun,
  Search,
  Activity,
  Bot,
  FileCode,
  Building2,
  Braces,
  Share2,
  Map,
  FolderKanban,
  Users,
  MessageCircle,
  Receipt,
  Settings2,
  Bell,
  Newspaper,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import type { ModuleId } from "@/lib/modules/registry";

/**
 * Catálogo único de destinos navegables (ADR-0030). La agrupación visible
 * (pills L1 + tabs L2) vive en nav-config.ts (AREA_ITEMS); los items que no
 * cuelgan de ningún área son transversales: accesibles por ⌘K, controles
 * globales (campana, menú de usuario) o enlaces contextuales.
 *
 * Cada destino pertenece a un módulo del registro central
 * (`src/lib/modules/registry.ts`, WO-2026-00088): la VISIBILIDAD la decide el
 * estado del módulo, no este catálogo. Los destinos de módulos ocultos se
 * conservan aquí para que reactivarlos sea cambiar un estado, no reescribir
 * la navegación.
 */
export interface PaletteNavItem {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  module: ModuleId;
}

export const PALETTE_NAV_ITEMS: PaletteNavItem[] = [
  // ── Inicio ──────────────────────────────────────────────────────────────────
  {
    href: "/hoy",
    label: "Inicio",
    description: "Clientes recientes y actividad del día",
    icon: Sun,
    module: "inicio",
  },
  // ── Trabajo (WO-2026-00132: reemplaza Proyectos/Definición/PixelForge) ──────
  {
    href: "/proyectos",
    label: "Trabajo",
    description: "Proyectos realizados y pendientes: estatus, avance, observaciones y recursos",
    icon: FolderKanban,
    module: "proyectos",
  },
  // ── Cotizaciones (WO-2026-00132) ─────────────────────────────────────────────
  {
    href: "/cotizaciones",
    label: "Cotizaciones",
    description: "Todas las cotizaciones: vencidas, próximas a vencer y el resto",
    icon: Receipt,
    module: "cotizaciones",
  },
  // ── Clientes ────────────────────────────────────────────────────────────────
  {
    href: "/clientes",
    label: "Cuentas",
    description: "Cuentas de clientes: información general, seguimiento, notas y actividad reciente",
    icon: Users,
    module: "clientes",
  },
  // ── WhatsApp (PixelBot vive dentro; excepción protegida) ────────────────────
  {
    href: "/whatsapp",
    label: "PixelBot",
    description: "Inbox del bot de WhatsApp: conversaciones en vivo, takeover humano y envío manual",
    icon: MessageCircle,
    module: "whatsapp",
  },
  // ── Blog (WO-2026-00088, paridad Encino) ────────────────────────────────────
  {
    href: "/blog-cms",
    label: "Blog",
    description: "Entradas del blog de pixeltec.mx: crear, editar, programar y publicar",
    icon: Newspaper,
    module: "blog",
  },
  // ── SEO (WO-2026-00095, portado de Muebles Encino) ──────────────────────────
  {
    href: "/seo/salud",
    label: "Salud SEO",
    description: "Qué está publicado, qué está a medias y qué falta del SEO de pixeltec.mx",
    icon: Activity,
    module: "seo",
  },
  {
    href: "/seo/llms",
    label: "llms.txt",
    description: "Guía para los modelos de IA sobre qué es este sitio y qué priorizar",
    icon: Bot,
    module: "seo",
  },
  {
    href: "/seo/robots",
    label: "robots.txt",
    description: "Reglas de rastreo para los buscadores y ubicación del sitemap",
    icon: FileCode,
    module: "seo",
  },
  {
    href: "/seo/local-business",
    label: "Negocio local",
    description: "Datos del negocio para Google: dirección, teléfono y horario (LocalBusiness)",
    icon: Building2,
    module: "seo",
  },
  {
    href: "/seo/structured-data",
    label: "Datos estructurados",
    description: "Entidades base del sitio en schema.org (Organization, WebSite)",
    icon: Braces,
    module: "seo",
  },
  {
    href: "/seo/schema",
    label: "Schema por página",
    description: "Tipos de datos estructurados asignados a cada página pública",
    icon: Search,
    module: "seo",
  },
  {
    href: "/seo/redes",
    label: "Redes sociales",
    description: "Enlaces del negocio que se publican como sameAs para Google",
    icon: Share2,
    module: "seo",
  },
  {
    href: "/seo/sitemap",
    label: "Sitemap",
    description: "El mapa del sitio que se entrega a Google",
    icon: Map,
    module: "seo",
  },
  // ── Finanzas ────────────────────────────────────────────────────────────────
  {
    href: "/cobros",
    label: "Cobros",
    description: "Cobros recurrentes, alertas de vencimiento y seguimiento por cliente",
    icon: Receipt,
    module: "finanzas",
  },
  // ── Usuarios ─────────────────────────────────────────────────────────────────
  {
    href: "/usuarios",
    label: "Usuarios",
    description: "Equipo interno: invitaciones, roles, suspensión y seguridad por cuenta",
    icon: UserCog,
    module: "usuarios",
  },
  // ── Transversales (solo ⌘K / controles globales) ────────────────────────────
  {
    href: "/notificaciones",
    label: "Notificaciones",
    description: "Centro de notificaciones del sistema",
    icon: Bell,
    module: "notificaciones",
  },
  {
    href: "/perfil",
    label: "Perfil y seguridad",
    description: "Perfil, acceso y seguridad",
    icon: Settings2,
    module: "perfil",
  },
];

export const MAX_RECENT_ROUTES = 5;
export const RECENT_ROUTES_KEY = "pixeltec_recent_routes";

export function getNavLabel(href: string): string {
  return PALETTE_NAV_ITEMS.find((item) => item.href === href)?.label ?? href;
}
