import {
  Sun,
  FolderKanban,
  Users,
  MessageCircle,
  Receipt,
  KeyRound,
  Server,
  FileText,
  Settings2,
  FolderOpen,
  Sparkles,
  Brain,
  Megaphone,
  CalendarDays,
  LayoutGrid,
  Send,
  Bell,
  Wand2,
  UserCog,
  type LucideIcon,
} from "lucide-react";

/**
 * Catálogo único de destinos navegables (ADR-0030). La agrupación visible
 * (pills L1 + tabs L2) vive en nav-config.ts (AREA_ITEMS); los items que no
 * cuelgan de ningún área son transversales: accesibles por ⌘K, controles
 * globales (campana, menú de usuario) o enlaces contextuales.
 */
export interface PaletteNavItem {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

export const PALETTE_NAV_ITEMS: PaletteNavItem[] = [
  // ── Hoy ─────────────────────────────────────────────────────────────────────
  {
    href: "/hoy",
    label: "Hoy",
    description: "Tareas del día, proyectos activos y actividad reciente de clientes",
    icon: Sun,
  },
  // ── Trabajo ─────────────────────────────────────────────────────────────────
  {
    href: "/proyectos",
    label: "Proyectos",
    description: "Vista maestra de todos los proyectos activos",
    icon: FolderKanban,
  },
  {
    href: "/proyectos/definicion",
    label: "Definición de proyectos",
    description: "Pipeline IA por estaciones para aterrizar ideas en entregables sellados",
    icon: Sparkles,
  },
  {
    href: "/proyectos/pixelforge",
    label: "PixelForge",
    description: "Landings diferenciadas por estaciones: contexto, estrategia, direcciones creativas y producción",
    icon: Wand2,
  },
  // ── Clientes ────────────────────────────────────────────────────────────────
  {
    href: "/clientes",
    label: "Cuentas",
    description: "Workspace completo por cliente (CRM): proyectos, contratos y facturación",
    icon: Users,
  },
  {
    href: "/whatsapp",
    label: "PixelBot",
    description: "Inbox del bot de WhatsApp: conversaciones en vivo, takeover humano y envío manual",
    icon: MessageCircle,
  },
  // ── Finanzas ────────────────────────────────────────────────────────────────
  {
    href: "/cobros",
    label: "Cobros",
    description: "Cobros recurrentes, alertas de vencimiento y seguimiento por cliente",
    icon: Receipt,
  },
  // ── Marketing ───────────────────────────────────────────────────────────────
  {
    href: "/crecimiento",
    label: "Resumen de marketing",
    description: "Hub de marketing: contenido, campañas, calendario, publicación y configuración de marca",
    icon: LayoutGrid,
  },
  {
    href: "/blog-admin",
    label: "Blog",
    description: "Gestión de posts, borradores y pipeline de contenido",
    icon: FileText,
  },
  {
    href: "/crecimiento/content-studio",
    label: "Contenido",
    description: "Genera posts con IA usando el contexto de tu marca (Content Studio)",
    icon: Sparkles,
  },
  {
    href: "/crecimiento/campanas",
    label: "Campañas",
    description: "Crea campañas completas desde un objetivo de negocio",
    icon: Megaphone,
  },
  {
    href: "/crecimiento/calendario",
    label: "Calendario",
    description: "Organiza y programa tus publicaciones por semana o mes",
    icon: CalendarDays,
  },
  {
    href: "/crecimiento/publisher",
    label: "Publicación",
    description: "Conecta Instagram y Facebook para publicar directamente (Publisher)",
    icon: Send,
  },
  {
    href: "/crecimiento/brand-brain",
    label: "Configuración de marca",
    description: "Memoria de negocio (Brand Brain): servicios, cliente ideal, voz y diferenciadores",
    icon: Brain,
  },
  // ── Sistema ─────────────────────────────────────────────────────────────────
  {
    href: "/vps",
    label: "Infraestructura",
    description: "VPS status, deploys y monitoreo",
    icon: Server,
  },
  {
    href: "/accesos",
    label: "Conocimiento",
    description: "Base de conocimiento, tips y documentación técnica",
    icon: KeyRound,
  },
  {
    href: "/ia-factory",
    label: "Plantillas",
    description: "Plantillas maestras (Centro IA) para contratos, facturas, discovery y documentos",
    icon: Sparkles,
  },
  {
    href: "/usuarios",
    label: "Usuarios y acceso",
    description: "Equipo interno: invitaciones, roles, suspensión y seguridad por cuenta",
    icon: UserCog,
  },
  // ── Transversales (solo ⌘K / controles globales) ────────────────────────────
  {
    href: "/documentos",
    label: "Archivo documental",
    description: "Contratos, facturas, propuestas, notas de pago y bienvenidas",
    icon: FolderOpen,
  },
  {
    href: "/notificaciones",
    label: "Notificaciones",
    description: "Centro de notificaciones del sistema",
    icon: Bell,
  },
  {
    href: "/perfil",
    label: "Perfil y seguridad",
    description: "Perfil, acceso y seguridad",
    icon: Settings2,
  },
];

export const MAX_RECENT_ROUTES = 5;
export const RECENT_ROUTES_KEY = "pixeltec_recent_routes";

export function getNavLabel(href: string): string {
  return PALETTE_NAV_ITEMS.find((item) => item.href === href)?.label ?? href;
}
