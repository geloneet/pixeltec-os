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
  // ── Trabajo (oculto por WO-2026-00088) ──────────────────────────────────────
  {
    href: "/proyectos",
    label: "Proyectos",
    description: "Vista maestra de todos los proyectos activos",
    icon: FolderKanban,
    module: "proyectos",
  },
  {
    href: "/proyectos/definicion",
    label: "Definición de proyectos",
    description: "Pipeline IA por estaciones para aterrizar ideas en entregables sellados",
    icon: Sparkles,
    module: "definicion",
  },
  {
    href: "/proyectos/pixelforge",
    label: "PixelForge",
    description: "Landings diferenciadas por estaciones: contexto, estrategia, direcciones creativas y producción",
    icon: Wand2,
    module: "pixelforge",
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
  // ── Finanzas ────────────────────────────────────────────────────────────────
  {
    href: "/cobros",
    label: "Cobros",
    description: "Cobros recurrentes, alertas de vencimiento y seguimiento por cliente",
    icon: Receipt,
    module: "finanzas",
  },
  // ── Marketing (oculto por WO-2026-00088) ────────────────────────────────────
  {
    href: "/crecimiento",
    label: "Resumen de marketing",
    description: "Hub de marketing: contenido, campañas, calendario, publicación y configuración de marca",
    icon: LayoutGrid,
    module: "marketing",
  },
  {
    href: "/blog-admin",
    label: "Blog anterior",
    description: "Sistema editorial legacy: posts, briefs y pipeline de contenido",
    icon: FileText,
    module: "blog-legacy",
  },
  {
    href: "/crecimiento/content-studio",
    label: "Contenido",
    description: "Genera posts con IA usando el contexto de tu marca (Content Studio)",
    icon: Sparkles,
    module: "contenido",
  },
  {
    href: "/crecimiento/campanas",
    label: "Campañas",
    description: "Crea campañas completas desde un objetivo de negocio",
    icon: Megaphone,
    module: "campanas",
  },
  {
    href: "/crecimiento/calendario",
    label: "Calendario",
    description: "Organiza y programa tus publicaciones por semana o mes",
    icon: CalendarDays,
    module: "calendario",
  },
  {
    href: "/crecimiento/publisher",
    label: "Publicación",
    description: "Conecta Instagram y Facebook para publicar directamente (Publisher)",
    icon: Send,
    module: "publicaciones",
  },
  {
    href: "/crecimiento/brand-brain",
    label: "Configuración de marca",
    description: "Memoria de negocio (Brand Brain): servicios, cliente ideal, voz y diferenciadores",
    icon: Brain,
    module: "brand-brain",
  },
  // ── Sistema (oculto por WO-2026-00088, salvo Usuarios y Accesos) ────────────
  {
    href: "/vps",
    label: "Infraestructura",
    description: "VPS status, deploys y monitoreo",
    icon: Server,
    module: "infraestructura",
  },
  {
    href: "/ia-factory",
    label: "Plantillas",
    description: "Plantillas maestras (Centro IA) para contratos, facturas, discovery y documentos",
    icon: Sparkles,
    module: "plantillas",
  },
  // ── Usuarios y Accesos (D-88-2: dos rutas, un módulo conceptual) ────────────
  {
    href: "/usuarios",
    label: "Usuarios",
    description: "Equipo interno: invitaciones, roles, suspensión y seguridad por cuenta",
    icon: UserCog,
    module: "usuarios",
  },
  {
    href: "/accesos",
    label: "Accesos",
    description: "Accesos y documentación técnica por herramienta",
    icon: KeyRound,
    module: "accesos",
  },
  // ── Transversales (solo ⌘K / controles globales) ────────────────────────────
  {
    href: "/documentos",
    label: "Archivo documental",
    description: "Contratos, facturas, propuestas, notas de pago y bienvenidas",
    icon: FolderOpen,
    module: "documentos",
  },
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
