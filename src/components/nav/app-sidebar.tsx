"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Sun,
  FolderKanban,
  Users,
  MessageCircle,
  Receipt,
  Newspaper,
  UserCog,
  Plus,
  type LucideIcon,
  Search,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SITE } from "@/lib/site-config";
import { useCmdK } from "@/components/cmd-k/CmdKProvider";
import { useCRM } from "@/components/crm/CRMContextCore";
import { useUserProfile } from "@/hooks/use-user-profile";
import {
  getVisibleNavAreas,
  NAV_AREA_LABELS,
  getAreaHref,
  getSecondaryItems,
  resolveActiveHref,
  countOpenTasks,
  type NavArea,
} from "./nav-config";
import { PALETTE_NAV_ITEMS } from "./command-palette-items";

/**
 * Icono representativo de cada área L1 (ADR-0030). Deliberadamente distinto
 * del icono del primer sub-ítem de PALETTE_NAV_ITEMS cuando ese ítem no
 * comunica bien el dominio completo (p. ej. "marketing" usa Megaphone en vez
 * del LayoutGrid del hub "Resumen").
 */
const AREA_ICONS: Record<NavArea, LucideIcon> = {
  hoy: Sun,
  crm: Users,
  whatsapp: MessageCircle,
  finanzas: Receipt,
  cotizaciones: Receipt,
  proyectos: FolderKanban,
  blog: Newspaper,
  seo: Search,
  usuarios: UserCog,
};

/**
 * Sidebar vertical flotante — desktop (`lg:` y superior). Reemplaza visualmente
 * el rail horizontal de TopNavigation en pantallas grandes; el mobile conserva
 * TopNavigation + SecondaryNavigation sin cambios (ver Shell en layout.tsx).
 *
 * Fuente de navegación: el mismo catálogo de nav-config.ts (ADR-0030) — cero
 * taxonomía nueva. Excepción al freeze de v1.0 (ver PixelTEC OS.md).
 */
export function AppSidebar({
  activeArea,
  className,
}: {
  activeArea: NavArea | null;
  className?: string;
}) {
  const pathname = usePathname();
  const { setOpen } = useCmdK();
  const { clients } = useCRM();

  const openTasksCount = countOpenTasks(clients);

  const activeHref = resolveActiveHref(PALETTE_NAV_ITEMS, pathname);
  // WO-2026-00051: el reviewer no ve áreas (solo presentación; el middleware manda).
  const { userProfile } = useUserProfile();
  const visibleAreas = getVisibleNavAreas(userProfile?.role);

  /**
   * Qué área tiene el submenú desplegado (Miguel, 2026-09-03). Antes el
   * submenú se abría solo por estar en el área, y no había forma de cerrarlo
   * sin salirse. Reglas:
   *  - entrar al área por su página principal (clic en el pill) ⇒ colapsado;
   *  - llegar directo a una página profunda (⌘K, enlace, recarga) ⇒ expandido,
   *    porque si no el menú no explicaría dónde estás;
   *  - navegar DENTRO de la misma área ⇒ se respeta lo que el usuario dejó;
   *  - cambiar de área ⇒ se reevalúa (y el área anterior se cierra sola).
   */
  const [expandedArea, setExpandedArea] = useState<NavArea | null>(null);
  useEffect(() => {
    setExpandedArea((prev) => {
      if (!activeArea) return null;
      if (prev === activeArea) return prev;
      return activeHref === getAreaHref(activeArea) ? null : activeArea;
    });
  }, [activeArea, activeHref]);

  return (
    <aside
      className={cn(
        "w-72 flex-shrink-0 flex-col gap-1.5 border-r border-sidebar-border bg-sidebar-background/40 px-4 py-6 backdrop-blur-xl",
        className
      )}
      aria-label="Navegación principal"
    >
      {/* Marca */}
      <Link href="/hoy" className="mb-6 flex items-center gap-3 px-2">
        <Image
          src={process.env.NEXT_PUBLIC_LOGO_URL ?? SITE.logoPath}
          alt="PixelTEC Logo"
          width={30}
          height={30}
          className="h-[30px] w-[30px] flex-shrink-0"
        />
        <span className="font-logo truncate text-xl font-extrabold uppercase tracking-tight text-foreground">
          Pixel<span className="text-brand-blue">Tec</span>
          {/* Identidad de producto visible (Miguel, 2026-08-26 §2). Solo UI:
              el repo, los paquetes, las rutas y las variables de entorno NO se
              renombran — sería una migración técnica sin beneficio. */}
          <span className="text-muted-foreground"> CRM</span>
        </span>
      </Link>

      {/* Áreas L1 */}
      <nav className="flex flex-1 flex-col gap-1.5 overflow-y-auto scrollbar-none">
        {visibleAreas.map((area) => {
          const Icon = AREA_ICONS[area];
          const active = area === activeArea;
          const secondaryItems = getSecondaryItems(area);
          const hasChildren = secondaryItems.length > 1;
          const expanded = expandedArea === area;
          const submenuId = `sidebar-submenu-${area}`;

          return (
            <div key={area} className="flex flex-col">
              {/* El Link NAVEGA y nunca alterna el submenú; el chevron hermano
                  (solo en el área activa con hijos) es lo único que lo abre y
                  lo cierra. Separarlos es el pedido de Miguel: entrar a SEO no
                  debe desplegar todo el menú. */}
              <div className="relative flex items-center">
                {/* La píldora activa envuelve fila + chevron (antes vivía dentro
                    del Link): si no, el chevron quedaría fuera del fondo oscuro
                    y su icono sería invisible. */}
                {active && (
                  <motion.span
                    layoutId="admin-sidebar-active-pill"
                    className="absolute inset-0 rounded-2xl bg-foreground"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <Link
                  href={getAreaHref(area)}
                  className={cn(
                    "relative flex min-w-0 flex-1 items-center gap-3 rounded-2xl py-2.5 pl-2.5 pr-3 text-[15px] transition-colors",
                    active ? "font-semibold text-background" : "font-medium text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "relative z-10 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition-colors",
                      active ? "bg-background/15" : "bg-secondary/60"
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                  </span>
                  <span className="relative z-10 flex-1 truncate">{NAV_AREA_LABELS[area]}</span>
                  {area === "proyectos" && openTasksCount > 0 && (
                    <span
                      className={cn(
                        "relative z-10 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold",
                        active ? "bg-background/20 text-background" : "bg-cyan-500/20 text-cyan-300"
                      )}
                    >
                      {openTasksCount}
                    </span>
                  )}
                </Link>

                {active && hasChildren && (
                  <button
                    type="button"
                    onClick={() => setExpandedArea((prev) => (prev === area ? null : area))}
                    aria-expanded={expanded}
                    aria-controls={submenuId}
                    aria-label={`${expanded ? "Ocultar" : "Mostrar"} submenú de ${NAV_AREA_LABELS[area]}`}
                    className="relative z-10 mr-1.5 inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-background/70 transition-colors hover:bg-background/20 hover:text-background"
                  >
                    <ChevronRight
                      className={cn("h-4 w-4 transition-transform duration-200", expanded && "rotate-90")}
                      strokeWidth={2}
                    />
                  </button>
                )}
              </div>

              <AnimatePresence initial={false}>
                {expanded && hasChildren && (
                  <motion.div
                    id={submenuId}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    className="overflow-hidden"
                  >
                    <div className="ml-[2.625rem] mt-1 flex flex-col gap-1 border-l border-sidebar-border py-1 pl-4">
                      {secondaryItems.map((item) => {
                        const subActive = item.href === activeHref;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                              "truncate rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                              subActive
                                ? "bg-sidebar-accent text-foreground"
                                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
                            )}
                          >
                            {item.secondaryLabel}
                          </Link>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>

      {/* Acción primaria — reutiliza el mismo ⌘K que "Buscar" en la topbar */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-foreground text-sm font-semibold text-background shadow-sm transition-all hover:bg-foreground/90 hover:shadow-md"
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} />
        Nuevo
        <kbd className="ml-auto hidden items-center rounded border border-background/20 bg-background/10 px-1.5 py-0.5 text-[10px] font-mono lg:inline-flex">
          ⌘K
        </kbd>
      </button>
    </aside>
  );
}
