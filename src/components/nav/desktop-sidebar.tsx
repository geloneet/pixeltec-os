"use client";

import { memo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronRight, LogOut, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import { signOut } from "firebase/auth";
import { useAuth } from "@/firebase";
import { useCRM } from "@/components/crm/CRMContextCore";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCmdK } from "@/components/cmd-k/CmdKProvider";
import {
  NAV_SECTION_LABELS,
  NAV_SECTION_ORDER,
  PALETTE_NAV_ITEMS,
  type NavSection,
  type PaletteNavItem,
} from "./command-palette-items";

// TODO: replace with the actual app version once exposed via an env var
// (e.g. NEXT_PUBLIC_APP_VERSION) or generated at build time from package.json.
const APP_VERSION = "v1.0.0";

type BadgeSeverity = "info" | "warning" | "danger";
interface BadgeMeta {
  count?: number;
  severity?: BadgeSeverity;
}

/**
 * VPS warning placeholder (static).
 * TODO: wire remaining entries to real data sources:
 *   - "/asistente"    → useCRM() pending tasks for the week
 *   - "/crypto-intel" → count of alertEvents triggered in the last 24h
 */
const BADGE_PLACEHOLDERS: Record<string, BadgeMeta> = {
  "/vps": { severity: "warning" },
};

/**
 * Resolves which single href in the catalog should light up for a given
 * pathname. Uses longest-prefix-wins so a parent route (e.g. /asistente)
 * doesn't fight an active sub-route (/asistente/historial). /dashboard
 * stays exact-match because it would otherwise swallow every admin path.
 */
function resolveActiveHref(items: PaletteNavItem[], pathname: string): string | null {
  let best: { href: string; length: number } | null = null;
  for (const item of items) {
    if (item.href === "/dashboard") {
      if (pathname === item.href) return item.href;
      continue;
    }
    const matches = pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (matches && (!best || item.href.length > best.length)) {
      best = { href: item.href, length: item.href.length };
    }
  }
  return best?.href ?? null;
}

function groupBySection(items: PaletteNavItem[]): Record<NavSection, PaletteNavItem[]> {
  const acc: Record<NavSection, PaletteNavItem[]> = {
    trabajo: [],
    finanzas: [],
    produccion: [],
    crecimiento: [],
    sistema: [],
  };
  for (const item of items) acc[item.section].push(item);
  return acc;
}

const BY_SECTION = groupBySection(PALETTE_NAV_ITEMS.filter((item) => !item.hidden));

/**
 * Liquid-glass backdrop. Stacks five layers behind the sidebar content
 * to imitate a translucent slab of glass: tinted base, technical grid,
 * top sheen, cyan radial accent, bottom depth, and a left-edge highlight
 * line. All `pointer-events-none` and `aria-hidden`.
 */
const SidebarBackdrop = memo(function SidebarBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 hidden overflow-hidden dark:block"
    >
      {/* 1. Tinted glass base — subtle bluish-zinc gradient that survives behind the backdrop-blur */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(24,24,27,0.55) 0%, rgba(9,9,11,0.65) 60%, rgba(9,9,11,0.75) 100%)",
        }}
      />

      {/* 2. Technical grid — soft cyan lines */}
      <svg className="absolute inset-0 h-full w-full opacity-80">
        <defs>
          <pattern id="sidebar-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="rgba(34,211,238,0.04)"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#sidebar-grid)" />
      </svg>

      {/* 3. Top sheen — fakes the reflection on the upper edge of a glass slab */}
      <div
        className="absolute inset-x-0 top-0 h-40"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.015) 40%, transparent 100%)",
        }}
      />

      {/* 4. Cyan radial accent — soft halo top-left */}
      <div
        className="absolute -left-16 -top-16 h-[360px] w-[320px]"
        style={{
          background:
            "radial-gradient(circle at top left, rgba(34,211,238,0.18) 0%, rgba(34,211,238,0.05) 35%, transparent 70%)",
          filter: "blur(48px)",
        }}
      />

      {/* 5. Bottom depth — gentle vignette that grounds the slab */}
      <div
        className="absolute inset-x-0 bottom-0 h-48"
        style={{
          background:
            "linear-gradient(0deg, rgba(0,0,0,0.35) 0%, transparent 100%)",
        }}
      />

      {/* 6. Left-edge highlight — vertical hairline of cyan tint along the inner border */}
      <div
        className="absolute left-0 top-0 bottom-0 w-px"
        style={{
          background:
            "linear-gradient(180deg, rgba(34,211,238,0.35) 0%, rgba(34,211,238,0.1) 30%, transparent 70%)",
        }}
      />
    </div>
  );
});

function PulseDot({ color = "cyan" }: { color?: "cyan" | "amber" | "red" }) {
  const palette = {
    cyan: { ping: "bg-cyan-400", core: "bg-cyan-400" },
    amber: { ping: "bg-amber-400", core: "bg-amber-400" },
    red: { ping: "bg-red-500", core: "bg-red-500" },
  }[color];
  return (
    <span className="relative flex h-2 w-2">
      <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-75", palette.ping)} />
      <span className={cn("relative inline-flex h-2 w-2 rounded-full", palette.core)} />
    </span>
  );
}

function ItemBadge({ badge, isCollapsed }: { badge: BadgeMeta | undefined; isCollapsed: boolean }) {
  if (!badge) return null;
  const { count, severity = "info" } = badge;

  if (typeof count === "number") {
    if (!isCollapsed) {
      return (
        <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-semibold bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-400/20">
          {count}
        </span>
      );
    }
    return (
      <span className="absolute top-1 right-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[9px] font-semibold bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-400/20">
        {count}
      </span>
    );
  }

  const dotColor: "cyan" | "amber" | "red" =
    severity === "danger" ? "red" : severity === "warning" ? "amber" : "cyan";

  if (!isCollapsed) {
    return (
      <span className="ml-auto">
        <PulseDot color={dotColor} />
      </span>
    );
  }
  return (
    <span className="absolute top-1.5 right-1.5">
      <PulseDot color={dotColor} />
    </span>
  );
}

export function DesktopSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAuth();
  const { setOpen: setCmdKOpen } = useCmdK();
  const { clients } = useCRM();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<NavSection>>(
    () => new Set<NavSection>(["sistema"]),
  );
  const toggleSection = (section: NavSection) =>
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });

  const activeHref = resolveActiveHref(PALETTE_NAV_ITEMS, pathname);

  // Derive open tasks count from useCRM()
  const openTasksCount = clients
    .flatMap(c => c.projects)
    .flatMap(p => p.tasks)
    .filter(t => t.status === "pendiente" || t.status === "en_progreso" || t.status === "en_revision").length;

  const handleLogout = async () => {
    if (!auth) return;
    await fetch("/api/auth/session", { method: "DELETE" });
    await signOut(auth);
    router.push("/login");
  };

  const toggleCollapsed = () => setIsCollapsed((c) => !c);

  return (
    <TooltipProvider delayDuration={100}>
      <aside
        aria-expanded={!isCollapsed}
        className={cn(
          "relative h-full flex-shrink-0 flex flex-col overflow-hidden",
          // Superficie: card/muted en light; liquid-glass translúcido + blur en dark
          "bg-muted/60 dark:bg-zinc-900/30 backdrop-blur-2xl backdrop-saturate-150",
          "border-r border-border",
          "shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_-1px_0_0_rgba(255,255,255,0.03)]",
          "transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
          isCollapsed ? "w-16" : "w-60"
        )}
      >
        <SidebarBackdrop />

        <div className="relative z-10 flex h-full flex-col">
          {/* ─── System Status Header ─────────────────────────────── */}
          <div
            className={cn(
              "flex items-center border-b border-border/60 h-16",
              isCollapsed ? "justify-center px-0" : "justify-between px-4"
            )}
          >
            {isCollapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={toggleCollapsed}
                    aria-label={`Expandir menú · ${APP_VERSION}`}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-primary dark:hover:text-cyan-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <PanelLeftOpen className="h-5 w-5" strokeWidth={1.75} />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  sideOffset={12}
                  className="z-[60] text-sm px-3 py-1.5 rounded-lg shadow-xl"
                >
                  Expandir menú · ONLINE · {APP_VERSION}
                </TooltipContent>
              </Tooltip>
            ) : (
              <>
                <div className="flex items-center gap-2.5">
                  <PulseDot color="cyan" />
                  <div className="flex flex-col leading-tight">
                    <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">
                      Online
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      PixelTEC OS · {APP_VERSION}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggleCollapsed}
                  aria-label="Colapsar menú"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <PanelLeftClose className="h-4 w-4" strokeWidth={1.75} />
                </button>
              </>
            )}
          </div>

          {/* ─── Nav items by section ─────────────────────────────── */}
          <nav className="flex-1 flex flex-col justify-center gap-0.5 py-4 overflow-y-auto overflow-x-hidden">
            {NAV_SECTION_ORDER.map((section, sectionIndex) => {
              const sectionItems = BY_SECTION[section];
              if (sectionItems.length === 0) return null;

              return (
                <div key={section} className="flex flex-col">
                  {sectionIndex > 0 && (
                    <div
                      aria-hidden="true"
                      className={cn(
                        "mx-3 h-px bg-border/60 transition-all duration-200 ease-out",
                        isCollapsed ? "my-1 opacity-0" : "my-2 opacity-100"
                      )}
                    />
                  )}

                  <button
                    type="button"
                    onClick={() => toggleSection(section)}
                    aria-expanded={!collapsedSections.has(section)}
                    tabIndex={isCollapsed ? -1 : 0}
                    className={cn(
                      "flex items-center justify-between px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground overflow-hidden whitespace-nowrap",
                      "transition-all duration-200 ease-out",
                      isCollapsed
                        ? "h-0 mb-0 opacity-0 pointer-events-none"
                        : "h-5 mb-1.5 opacity-100"
                    )}
                  >
                    <span>{NAV_SECTION_LABELS[section]}</span>
                    <ChevronRight
                      className={cn(
                        "h-3 w-3 transition-transform duration-200",
                        !collapsedSections.has(section) && "rotate-90"
                      )}
                    />
                  </button>

                  {(isCollapsed || !collapsedSections.has(section)) && sectionItems.map((item) => {
                    const active = item.href === activeHref;
                    const Icon = item.icon;
                    const badge = item.href === "/tareas" && openTasksCount > 0
                      ? { count: openTasksCount, severity: "info" as const }
                      : BADGE_PLACEHOLDERS[item.href];

                    return (
                      <Tooltip key={item.href} open={isCollapsed ? undefined : false}>
                        <TooltipTrigger asChild>
                          <Link
                            href={item.href}
                            className={cn(
                              "group/item relative flex items-center gap-3 mx-2 px-3 h-10 rounded-lg",
                              "transition-all duration-200",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                              active
                                ? "bg-primary/10 text-primary shadow-sm dark:bg-transparent dark:bg-gradient-to-r dark:from-cyan-500/[0.12] dark:via-cyan-500/[0.06] dark:to-transparent dark:text-cyan-100 dark:shadow-[inset_0_0_0_1px_rgba(34,211,238,0.25),0_0_20px_-8px_rgba(34,211,238,0.5)]"
                                : "text-muted-foreground hover:bg-accent hover:text-foreground"
                            )}
                          >
                            {active && (
                              <span
                                aria-hidden="true"
                                className="absolute -left-2 top-1.5 bottom-1.5 w-[3px] rounded-r bg-primary dark:bg-cyan-400 dark:shadow-[0_0_12px_rgba(34,211,238,0.7)]"
                              />
                            )}
                            <Icon
                              className={cn(
                                "h-7 w-7 flex-shrink-0 transition-colors",
                                active
                                  ? "text-primary dark:text-cyan-300 dark:drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]"
                                  : "text-muted-foreground group-hover/item:text-foreground"
                              )}
                              strokeWidth={1.75}
                            />
                            <span
                              className={cn(
                                "text-sm font-medium whitespace-nowrap overflow-hidden",
                                "transition-[max-width,opacity] duration-200 ease-out delay-75",
                                isCollapsed ? "max-w-0 opacity-0" : "max-w-[180px] opacity-100"
                              )}
                            >
                              {item.label}
                            </span>
                            <ItemBadge badge={badge} isCollapsed={isCollapsed} />
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent
                          side="right"
                          sideOffset={12}
                          className="z-[60] text-sm px-3 py-1.5 rounded-lg shadow-xl"
                        >
                          {item.label}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              );
            })}
          </nav>

          {/* ─── Command Palette trigger ──────────────────────────── */}
          <div className="flex flex-col border-t border-border/60 pt-3">
            <Tooltip open={isCollapsed ? undefined : false}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setCmdKOpen(true)}
                  aria-label="Abrir paleta de comandos (⌘K)"
                  className={cn(
                    "group/cmdk relative mx-2 flex items-center gap-3 h-10 px-3 rounded-lg",
                    "bg-secondary/60 border border-border",
                    "hover:bg-secondary hover:border-cyan-400/30",
                    "transition-all duration-200",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  )}
                >
                  <Search
                    className="h-7 w-7 flex-shrink-0 text-muted-foreground transition-colors group-hover/cmdk:text-primary dark:group-hover/cmdk:text-cyan-300"
                    strokeWidth={1.75}
                  />
                  <span
                    className={cn(
                      "text-sm text-muted-foreground whitespace-nowrap overflow-hidden transition-[max-width,opacity] duration-200 ease-out delay-75 group-hover/cmdk:text-foreground",
                      isCollapsed ? "max-w-0 opacity-0" : "max-w-[120px] opacity-100"
                    )}
                  >
                    Buscar...
                  </span>
                  <kbd
                    aria-hidden="true"
                    className={cn(
                      "ml-auto inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-secondary border border-border text-[10px] font-mono text-muted-foreground transition-opacity duration-200 delay-75",
                      isCollapsed ? "opacity-0" : "opacity-100"
                    )}
                  >
                    ⌘K
                  </kbd>
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                sideOffset={12}
                className="z-[60] text-sm px-3 py-1.5 rounded-lg shadow-xl"
              >
                Buscar · ⌘K
              </TooltipContent>
            </Tooltip>
          </div>

          {/* ─── Logout (handler intacto) ─────────────────────────── */}
          <div className="flex flex-col pt-1.5 pb-2">
            <Tooltip open={isCollapsed ? undefined : false}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleLogout}
                  className={cn(
                    "group/logout flex items-center gap-3 mx-2 px-3 h-10 rounded-lg",
                    "text-muted-foreground hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300",
                    "transition-all duration-200",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  )}
                >
                  <LogOut
                    className="h-7 w-7 flex-shrink-0 text-muted-foreground transition-colors group-hover/logout:text-red-600 dark:group-hover/logout:text-red-300"
                    strokeWidth={1.75}
                  />
                  <span
                    className={cn(
                      "text-sm font-medium whitespace-nowrap overflow-hidden",
                      "transition-[max-width,opacity] duration-200 ease-out delay-75",
                      isCollapsed ? "max-w-0 opacity-0" : "max-w-[160px] opacity-100"
                    )}
                  >
                    Cerrar sesión
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                sideOffset={12}
                className="z-[60] text-sm px-3 py-1.5 rounded-lg shadow-xl"
              >
                Cerrar sesión
              </TooltipContent>
            </Tooltip>
          </div>

          {/* ─── Identity footer (expanded only) ──────────────────── */}
          <div
            aria-hidden="true"
            className={cn(
              "px-4 pb-3 text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground/60 text-center transition-opacity duration-200",
              isCollapsed ? "opacity-0" : "opacity-100"
            )}
          >
            PXT // BUILT FOR SCALE
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
