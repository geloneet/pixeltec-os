"use client";

import { Search } from "lucide-react";
import { useCmdK } from "@/components/cmd-k/CmdKProvider";
import { cn } from "@/lib/utils";
import { NotificationsMenu } from "./notifications-menu";
import { UserMenu } from "./user-menu";
import { NAV_AREA_LABELS, type NavArea } from "./nav-config";

function OnlineDot() {
  return (
    <span className="relative hidden h-2 w-2 flex-shrink-0 sm:flex">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
    </span>
  );
}

/**
 * Topbar delgado — desktop (`lg:` y superior), compañero de AppSidebar. La
 * marca y las áreas L1 viven ahora en el sidebar; esta barra solo conserva
 * los controles globales (buscar ⌘K, estado online, notificaciones, usuario)
 * que antes vivían en TopNavigation. El mobile sigue usando TopNavigation
 * completo — ver Shell en layout.tsx.
 */
export function AdminTopbar({
  activeArea,
  className,
}: {
  activeArea: NavArea | null;
  className?: string;
}) {
  const { setOpen } = useCmdK();

  return (
    <header
      className={cn(
        "h-16 w-full flex-shrink-0 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-lg lg:px-8",
        className
      )}
    >
      {/* Miguel (2026-08-26): el producto siempre visible — con varios
          proyectos abiertos, el nombre del área solo no dice dónde estás. */}
      <span className="flex min-w-0 items-center gap-2 text-sm">
        <span className="font-semibold tracking-tight text-foreground">PIXELTEC-OS</span>
        {activeArea ? (
          <>
            <span aria-hidden className="text-muted-foreground/50">·</span>
            <span className="truncate font-medium text-muted-foreground">{NAV_AREA_LABELS[activeArea]}</span>
          </>
        ) : null}
      </span>

      <div className="flex flex-shrink-0 items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir buscador"
          className="flex h-9 items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 text-muted-foreground backdrop-blur-md transition-all duration-200 hover:bg-secondary hover:text-foreground"
        >
          <Search className="h-4 w-4" />
          <span className="text-xs">Buscar</span>
          <kbd className="inline-flex items-center rounded border border-border bg-background/40 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
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
