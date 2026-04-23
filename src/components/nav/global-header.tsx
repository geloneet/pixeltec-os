"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { LayoutGrid, Search } from "lucide-react";
import { useCmdK } from "@/components/cmd-k/CmdKProvider";
import { PALETTE_NAV_ITEMS } from "./command-palette-items";
import { UserMenu } from "./user-menu";
import { NotificationsMenu } from "./notifications-menu";

function currentPageLabel(pathname: string): string {
  const item = PALETTE_NAV_ITEMS.find(
    (item) =>
      pathname === item.href || pathname.startsWith(`${item.href}/`)
  );
  return item?.label ?? "PixelTEC OS";
}

export function GlobalHeader() {
  const { setOpen } = useCmdK();
  const pathname = usePathname();
  const pageLabel = currentPageLabel(pathname);

  return (
    <header className="relative flex-shrink-0 w-full flex items-center h-14 sm:h-16 px-4 sm:px-6 lg:px-8">
      {/* ── LEFT: Logo + page title ──────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Image
          src={process.env.NEXT_PUBLIC_LOGO_URL!}
          alt="PixelTEC Logo"
          width={36}
          height={36}
          className="flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9"
        />
        <span className="font-logo font-extrabold uppercase tracking-tighter text-gray-100 text-xl sm:text-2xl flex-shrink-0">
          Pixel<span className="text-brand-blue">Tec</span>
        </span>
        <span className="hidden lg:block text-zinc-500 text-sm font-medium truncate">
          / {pageLabel}
        </span>
      </div>

      {/* ── CENTER: Page title (mobile only, absolute) ───────────────────────── */}
      <span
        className="lg:hidden absolute left-1/2 -translate-x-1/2 font-logo font-bold uppercase tracking-tighter text-gray-100 text-base sm:text-lg pointer-events-none select-none whitespace-nowrap"
        onClick={() => setOpen(true)}
      >
        {pageLabel}
      </span>

      {/* ── RIGHT: Search + Notifications + UserMenu ─────────────────────────── */}
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        {/* Command Palette trigger */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menú de navegación"
          className="flex items-center gap-2 h-9 sm:h-10 px-3 rounded-full border backdrop-blur-md bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 transition-all duration-200"
        >
          <LayoutGrid className="w-4 h-4 sm:hidden" />
          <span className="text-xs font-medium sm:hidden">Menú</span>
          <Search className="w-4 h-4 hidden sm:block" />
          <span className="hidden sm:block text-xs">Buscar</span>
          <kbd className="hidden lg:inline-flex items-center rounded border border-white/10 bg-black/40 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400">
            ⌘K
          </kbd>
        </button>

        <NotificationsMenu />
        <UserMenu />
      </div>
    </header>
  );
}
