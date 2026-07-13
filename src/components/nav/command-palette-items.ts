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
  BarChart3,
  Send,
  Bell,
  type LucideIcon,
} from "lucide-react";

export type NavSection = "trabajo" | "finanzas" | "produccion" | "sistema" | "crecimiento";

export interface PaletteNavItem {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  section: NavSection;
  /** Items with hidden:true are excluded from sidebar and ⌘K palette. */
  hidden?: boolean;
}

export const PALETTE_NAV_ITEMS: PaletteNavItem[] = [
  // ── Trabajo (operación diaria) ────────────────────────────────────────────
  {
    href: "/hoy",
    label: "Hoy",
    description: "Tareas del día, proyectos activos y actividad reciente de clientes",
    icon: Sun,
    section: "trabajo",
  },
  {
    href: "/clientes",
    label: "Clientes",
    description: "Workspace completo por cliente: proyectos, contratos y facturación",
    icon: Users,
    section: "trabajo",
  },
  {
    href: "/whatsapp",
    label: "WhatsApp",
    description: "Inbox del bot: conversaciones en vivo, takeover humano y envío manual",
    icon: MessageCircle,
    section: "trabajo",
  },
  {
    href: "/proyectos",
    label: "Proyectos",
    description: "Vista maestra de todos los proyectos activos",
    icon: FolderKanban,
    section: "trabajo",
  },
  {
    href: "/proyectos/definicion",
    label: "Definición de proyectos",
    description: "Pipeline IA por estaciones para aterrizar ideas en entregables sellados",
    icon: Sparkles,
    section: "trabajo",
  },
  // ── Finanzas ──────────────────────────────────────────────────────────────
  {
    href: "/cobros",
    label: "Cobros",
    description: "Cobros recurrentes, alertas de vencimiento y seguimiento por cliente",
    icon: Receipt,
    section: "finanzas",
  },
  {
    href: "/documentos",
    label: "Documentos",
    description: "Contratos, facturas, propuestas, notas de pago y bienvenidas",
    icon: FolderOpen,
    section: "finanzas",
  },
  // ── Producción ────────────────────────────────────────────────────────────
  {
    href: "/ia-factory",
    label: "Centro IA",
    description: "Plantillas maestras para contratos, facturas, discovery y documentos",
    icon: Sparkles,
    section: "produccion",
    hidden: false,
  },
  {
    href: "/accesos",
    label: "Conocimiento",
    description: "Base de conocimiento, tips y documentación técnica",
    icon: KeyRound,
    section: "produccion",
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
  // ── Crecimiento (Growth Suite) ────────────────────────────────────────────
  {
    href: "/crecimiento/brand-brain",
    label: "Brand Brain",
    description: "Memoria de negocio: servicios, cliente ideal, voz y diferenciadores",
    icon: Brain,
    section: "crecimiento",
  },
  {
    href: "/crecimiento/content-studio",
    label: "Content Studio",
    description: "Genera posts con IA usando el contexto de tu marca",
    icon: Sparkles,
    section: "crecimiento",
  },
  {
    href: "/crecimiento/campanas",
    label: "Campañas",
    description: "Crea campañas completas desde un objetivo de negocio",
    icon: Megaphone,
    section: "crecimiento",
  },
  {
    href: "/crecimiento/calendario",
    label: "Calendario",
    description: "Organiza y programa tus publicaciones por semana o mes",
    icon: CalendarDays,
    section: "crecimiento",
  },
  {
    href: "/crecimiento/publisher",
    label: "Publisher",
    description: "Conecta Instagram y Facebook para publicar directamente",
    icon: Send,
    section: "crecimiento",
  },
  {
    href: "/crecimiento/analytics",
    label: "Analytics",
    description: "Métricas de engagement y rendimiento de contenido",
    icon: BarChart3,
    section: "crecimiento",
    hidden: true,
  },
  // ── Overflow (solo visible en el menú "Más…" de la Top Navigation) ──────────
  {
    href: "/notificaciones",
    label: "Notificaciones",
    description: "Centro de notificaciones del sistema",
    icon: Bell,
    section: "sistema",
    hidden: true,
  },
];

export const NAV_SECTION_ORDER: NavSection[] = ["trabajo", "finanzas", "produccion", "crecimiento", "sistema"];

export const NAV_SECTION_LABELS: Record<NavSection, string> = {
  trabajo: "Trabajo",
  finanzas: "Finanzas",
  produccion: "Producción",
  crecimiento: "Crecimiento",
  sistema: "Sistema",
};

export const MAX_RECENT_ROUTES = 5;
export const RECENT_ROUTES_KEY = "pixeltec_recent_routes";

export function getNavLabel(href: string): string {
  return PALETTE_NAV_ITEMS.find((item) => item.href === href)?.label ?? href;
}
