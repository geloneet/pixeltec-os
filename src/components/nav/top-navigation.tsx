"use client";

import { usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Search, LayoutGrid } from "lucide-react";
import { useCmdK } from "@/components/cmd-k/CmdKProvider";
import { useCRM } from "@/components/crm/CRMContextCore";
import { cn } from "@/lib/utils";
import { NotificationsMenu } from "./notifications-menu";
import { UserMenu } from "./user-menu";
import {
  NAV_AREA_ORDER,
  NAV_AREA_LABELS,
  getAreaHref,
  getActiveArea,
} from "./nav-config";

function OnlineDot() {
  return (
    <span className="relative hidden h-2 w-2 flex-shrink-0 sm:flex">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
    </span>
  );
}

export function TopNavigation() {
  const pathname = usePathname();
  const { setOpen } = useCmdK();
  const { clients } = useCRM();

  const activeArea = getActiveArea(pathname);

  const openTasksCount = clients
    .flatMap((c) => c.projects)
    .flatMap((p) => p.tasks)
    .filter(
      (t) =>
        t.status === "pendiente" ||
        t.status === "en_progreso" ||
        t.status === "en_revision"
    ).length;

  return (
    <header className="relative flex h-20 w-full flex-shrink-0 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-lg sm:px-6 lg:px-8">
      {/* ── LEFT: logo + área actual ─────────────────────────────────────── */}
      <div className="flex flex-shrink-0 items-center gap-4">
        <Image
          src={process.env.NEXT_PUBLIC_LOGO_URL!}
          alt="PixelTEC Logo"
          width={32}
          height={32}
          className="h-8 w-8"
        />
        <span className="font-logo whitespace-nowrap text-xl font-extrabold uppercase tracking-tight text-foreground">
          Pixel<span className="text-brand-blue">Tec</span>
          {activeArea && (
            <span className="ml-2 hidden font-sans text-lg normal-case text-muted-foreground lg:inline">
              / {NAV_AREA_LABELS[activeArea]}
            </span>
          )}
        </span>
      </div>

      {/* ── CENTER: pills (segmented control), scrollable en mobile ──────── */}
      <nav
        aria-label="Navegación principal"
        className="scrollbar-none mx-2 flex flex-1 items-center justify-start overflow-x-auto lg:justify-center"
      >
        <div className="flex items-center gap-1 rounded-full bg-secondary/60 p-1.5">
          {NAV_AREA_ORDER.map((area) => {
            const active = area === activeArea;
            return (
              <Link
                key={area}
                href={getAreaHref(area)}
                className={cn(
                  "relative shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                  active ? "text-background" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="admin-top-nav-active-pill"
                    className="absolute inset-0 rounded-full bg-foreground"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <span className="relative z-10 inline-flex items-center gap-1.5">
                  {NAV_AREA_LABELS[area]}
                  {area === "proyectos" && openTasksCount > 0 && (
                    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-cyan-500/20 px-1 text-[10px] font-semibold text-cyan-300">
                      {openTasksCount}
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ── RIGHT: buscar + online + notificaciones + perfil ─────────────── */}
      <div className="flex flex-shrink-0 items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir buscador"
          className="flex h-9 items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 text-muted-foreground backdrop-blur-md transition-all duration-200 hover:bg-secondary hover:text-foreground sm:h-10"
        >
          <LayoutGrid className="h-4 w-4 sm:hidden" />
          <span className="text-xs font-medium sm:hidden">Menú</span>
          <Search className="hidden h-4 w-4 sm:block" />
          <span className="hidden text-xs sm:block">Buscar</span>
          <kbd className="hidden items-center rounded border border-border bg-background/40 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground lg:inline-flex">
            ⌘K
          </kbd>
        </button>

        <OnlineDot />

        <NotificationsMenu />
        <UserMenu />
      </div>
    </header>
  );
}
