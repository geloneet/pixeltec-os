"use client";

import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { MoreHorizontal, Search, LayoutGrid } from "lucide-react";
import { useCmdK } from "@/components/cmd-k/CmdKProvider";
import { useCRM } from "@/components/crm/CRMContextCore";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationsMenu } from "./notifications-menu";
import { UserMenu } from "./user-menu";
import {
  NAV_AREA_ORDER,
  NAV_AREA_LABELS,
  getAreaHref,
  getActiveArea,
  getActiveItem,
  OVERFLOW_ITEMS,
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
  const router = useRouter();
  const pathname = usePathname();
  const { setOpen } = useCmdK();
  const { clients } = useCRM();

  const activeArea = getActiveArea(pathname);
  const activeItem = getActiveItem(pathname);
  const isOverflowActive = !!activeItem?.hidden;

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
    <header className="relative flex h-20 w-full flex-shrink-0 items-center justify-between border-b border-white/10 bg-[#030303]/80 px-4 backdrop-blur-lg sm:px-6 lg:px-8">
      {/* ── LEFT: logo + área actual ─────────────────────────────────────── */}
      <div className="flex flex-shrink-0 items-center gap-4">
        <Image
          src={process.env.NEXT_PUBLIC_LOGO_URL!}
          alt="PixelTEC Logo"
          width={32}
          height={32}
          className="h-8 w-8"
        />
        <span className="font-logo whitespace-nowrap text-xl font-extrabold uppercase tracking-tight text-gray-100">
          Pixel<span className="text-brand-blue">Tec</span>
          <span className="ml-2 hidden font-sans text-lg normal-case text-zinc-400 lg:inline">
            / {activeArea ? NAV_AREA_LABELS[activeArea] : "Dashboard"}
          </span>
        </span>
      </div>

      {/* ── CENTER: pills (segmented control), scrollable en mobile ──────── */}
      <nav
        aria-label="Navegación principal"
        className="scrollbar-none mx-2 flex flex-1 items-center justify-start overflow-x-auto lg:justify-center"
      >
        <div className="flex items-center gap-1 rounded-full bg-white/5 p-1.5">
          {NAV_AREA_ORDER.map((area) => {
            const active = area === activeArea;
            return (
              <Link
                key={area}
                href={getAreaHref(area)}
                className={cn(
                  "relative shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                  active ? "text-black" : "text-zinc-400 hover:text-white"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="admin-top-nav-active-pill"
                    className="absolute inset-0 rounded-full bg-white"
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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "relative flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                  isOverflowActive
                    ? "bg-white text-black"
                    : "text-zinc-400 hover:text-white"
                )}
              >
                Más
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="center"
              sideOffset={10}
              className="w-56 rounded-xl border border-white/10 bg-[#0a0a0a]/95 p-1 text-zinc-100 backdrop-blur-xl"
            >
              {OVERFLOW_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <DropdownMenuItem
                    key={item.href}
                    onClick={() => router.push(item.href)}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-zinc-300 focus:bg-white/10 focus:text-white"
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" strokeWidth={1.75} />
                    {item.label}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>

      {/* ── RIGHT: buscar + online + notificaciones + perfil ─────────────── */}
      <div className="flex flex-shrink-0 items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir buscador"
          className="flex h-9 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 text-zinc-400 backdrop-blur-md transition-all duration-200 hover:bg-white/10 hover:text-white sm:h-10"
        >
          <LayoutGrid className="h-4 w-4 sm:hidden" />
          <span className="text-xs font-medium sm:hidden">Menú</span>
          <Search className="hidden h-4 w-4 sm:block" />
          <span className="hidden text-xs sm:block">Buscar</span>
          <kbd className="hidden items-center rounded border border-white/10 bg-black/40 px-1.5 py-0.5 text-[10px] font-mono text-zinc-500 lg:inline-flex">
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
