"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Command as Cmdk } from "cmdk";
import {
  CheckSquare,
  Clock,
  Rocket,
  Search,
  Server,
  Users,
} from "lucide-react";
import { useCmdK } from "@/components/cmd-k/CmdKProvider";
import { useCRM } from "@/components/crm/CRMContextCore";
import { useVpsStatus } from "@/lib/vps-swr";
import { normalize, searchAcrossCRM } from "@/lib/cmdk-search";
import {
  PALETTE_NAV_ITEMS,
  RECENT_ROUTES_KEY,
  MAX_RECENT_ROUTES,
  type PaletteNavItem,
} from "./command-palette-items";
import { NAV_AREA_ORDER, NAV_AREA_LABELS, getItemArea, type NavArea } from "./nav-config";
import { cn } from "@/lib/utils";

// ─── Recent routes ────────────────────────────────────────────────────────────

function getRecentRoutes(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_ROUTES_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function pushRecentRoute(href: string) {
  try {
    const current = getRecentRoutes().filter((r) => r !== href);
    const next = [href, ...current].slice(0, MAX_RECENT_ROUTES);
    localStorage.setItem(RECENT_ROUTES_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable — SSR or private mode
  }
}

// ─── Shared item class ────────────────────────────────────────────────────────

const ITEM_CLS =
  "group flex items-center gap-3 px-2 py-2.5 rounded-xl cursor-pointer " +
  "aria-selected:bg-accent hover:bg-accent transition-colors duration-150 " +
  "data-[selected=true]:bg-accent";

const ICON_CLS =
  "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg " +
  "bg-muted/60 border border-border transition-colors duration-150";

const GROUP_CLS =
  "[&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:uppercase " +
  "[&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-muted-foreground " +
  "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 " +
  "[&_[cmdk-group-heading]]:font-medium";

const DIVIDER = (
  <div className="my-1 mx-2 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
);

// ─── Command Palette ──────────────────────────────────────────────────────────

export function CommandPalette() {
  const { open, setOpen } = useCmdK();
  const [query, setQuery] = useState("");
  const [recentRoutes, setRecentRoutes] = useState<string[]>([]);
  const router = useRouter();
  const pathname = usePathname();
  const crm = useCRM();
  const { data: vpsData } = useVpsStatus();

  // Record current route in recents
  useEffect(() => {
    const navItem = PALETTE_NAV_ITEMS.find(
      (item) =>
        pathname === item.href || pathname.startsWith(`${item.href}/`)
    );
    if (navItem) pushRecentRoute(navItem.href);
  }, [pathname]);

  // On open: load recents + clear query
  useEffect(() => {
    if (open) {
      setRecentRoutes(getRecentRoutes());
      setQuery("");
    }
  }, [open]);

  const results = useMemo(
    () =>
      searchAcrossCRM({
        query,
        clients: crm.clients || [],
        vpsProjects: vpsData?.projects || [],
      }),
    [query, crm.clients, vpsData?.projects]
  );

  const filteredNavItems = useMemo<PaletteNavItem[]>(() => {
    const visible = PALETTE_NAV_ITEMS.filter((item) => !item.hidden);
    if (!query) return visible;
    const q = normalize(query);
    return visible.filter(
      (item) =>
        normalize(item.label).includes(q) ||
        normalize(item.description).includes(q)
    );
  }, [query]);

  // Agrupa los resultados de "Navegar" por área (la misma taxonomía de la
  // Top Navigation) en vez de una lista plana.
  const navItemsByArea = useMemo(() => {
    const map = new Map<NavArea, PaletteNavItem[]>();
    for (const item of filteredNavItems) {
      const area = getItemArea(item.href);
      if (!area) continue;
      if (!map.has(area)) map.set(area, []);
      map.get(area)!.push(item);
    }
    return map;
  }, [filteredNavItems]);

  const recentNavItems = useMemo<PaletteNavItem[]>(
    () =>
      recentRoutes
        .map((href) => PALETTE_NAV_ITEMS.find((item) => item.href === href))
        .filter((item): item is PaletteNavItem => !!item && !item.hidden)
        .filter((item) => item.href !== pathname),
    [recentRoutes, pathname]
  );

  const handleNavigate = useCallback(
    (href: string) => {
      setOpen(false);
      pushRecentRoute(href);
      router.push(href);
    },
    [setOpen, router]
  );

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        {/* Backdrop */}
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-background/80 dark:bg-black/60 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
          )}
        />

        {/* Panel */}
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            "fixed left-1/2 top-[15%] z-50 -translate-x-1/2",
            "w-[calc(100vw-2rem)] max-w-2xl",
            // Glass
            "bg-popover/90 backdrop-blur-2xl",
            "border border-border rounded-2xl",
            "shadow-2xl dark:shadow-[0_0_120px_-20px_rgba(59,130,246,0.3)]",
            "overflow-hidden",
            // Animation
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            "duration-200"
          )}
        >
          <DialogPrimitive.Title className="sr-only">
            Buscar y navegar
          </DialogPrimitive.Title>

          <Cmdk shouldFilter={false} className="bg-transparent flex flex-col overflow-hidden">
            {/* Input */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border/60">
              <Search className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <Cmdk.Input
                className="flex-1 min-w-0 bg-transparent text-base text-foreground placeholder:text-muted-foreground outline-none"
                placeholder="Buscar o navegar..."
                value={query}
                onValueChange={setQuery}
                autoFocus
              />
              <kbd className="hidden sm:inline-flex items-center rounded border border-border bg-background/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                ESC
              </kbd>
            </div>

            <Cmdk.List className="max-h-[380px] overflow-y-auto overflow-x-hidden p-2">
              <Cmdk.Empty className="py-10 text-center text-sm text-muted-foreground">
                {query
                  ? `Sin resultados para "${query}"`
                  : "Empieza a escribir..."}
              </Cmdk.Empty>

              {/* Navegar — agrupado por área (misma taxonomía de la Top Navigation) */}
              {NAV_AREA_ORDER.map((area) => {
                const items = navItemsByArea.get(area);
                if (!items || items.length === 0) return null;
                return (
                  <Cmdk.Group
                    key={area}
                    heading={NAV_AREA_LABELS[area]}
                    className={GROUP_CLS}
                  >
                    {items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Cmdk.Item
                          key={item.href}
                          value={`nav-${item.href}`}
                          onSelect={() => handleNavigate(item.href)}
                          className={ITEM_CLS}
                        >
                          <span
                            className={cn(
                              ICON_CLS,
                              "text-muted-foreground aria-selected:text-cyan-600 dark:aria-selected:text-cyan-400 group-aria-selected:text-cyan-600 dark:group-aria-selected:text-cyan-400 group-aria-selected:border-cyan-500/30 dark:group-aria-selected:border-cyan-900/50 group-aria-selected:bg-cyan-500/10 dark:group-aria-selected:bg-cyan-950/30"
                            )}
                          >
                            <Icon className="h-4 w-4" strokeWidth={1.75} />
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-foreground truncate">
                              {item.label}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {item.description}
                            </div>
                          </div>
                        </Cmdk.Item>
                      );
                    })}
                  </Cmdk.Group>
                );
              })}

              {/* Recientes (only when no query) */}
              {!query && recentNavItems.length > 0 && (
                <>
                  {DIVIDER}
                  <Cmdk.Group heading="Recientes" className={GROUP_CLS}>
                    {recentNavItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Cmdk.Item
                          key={`recent-${item.href}`}
                          value={`recent-${item.href}`}
                          onSelect={() => handleNavigate(item.href)}
                          className={ITEM_CLS}
                        >
                          <span className={cn(ICON_CLS, "text-muted-foreground")}>
                            <Clock className="h-3.5 w-3.5" />
                          </span>
                          <div className="flex-1 min-w-0 flex items-center gap-2">
                            <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="text-sm text-muted-foreground truncate">
                              {item.label}
                            </span>
                          </div>
                        </Cmdk.Item>
                      );
                    })}
                  </Cmdk.Group>
                </>
              )}

              {/* CRM: Clientes */}
              {results.clients.length > 0 && (
                <>
                  {DIVIDER}
                  <Cmdk.Group heading="Clientes" className={GROUP_CLS}>
                    {results.clients.map((client) => (
                      <Cmdk.Item
                        key={`client-${client.id}`}
                        value={normalize(
                          `cliente ${client.name} ${client.email}`
                        )}
                        onSelect={() =>
                          handleNavigate(`/clientes/${client.id}`)
                        }
                        className={ITEM_CLS}
                      >
                        <span className={cn(ICON_CLS, "text-blue-400")}>
                          <Users className="h-4 w-4" strokeWidth={1.75} />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">
                            {client.name}
                          </div>
                          {client.email && (
                            <div className="text-xs text-muted-foreground truncate">
                              {client.email}
                            </div>
                          )}
                        </div>
                      </Cmdk.Item>
                    ))}
                  </Cmdk.Group>
                </>
              )}

              {/* CRM: Proyectos */}
              {results.projects.length > 0 && (
                <>
                  {DIVIDER}
                  <Cmdk.Group heading="Proyectos" className={GROUP_CLS}>
                    {results.projects.map((p) => (
                      <Cmdk.Item
                        key={`project-${p.id}`}
                        value={normalize(`proyecto ${p.name} ${p.clientName}`)}
                        onSelect={() => handleNavigate(`/proyectos/${p.id}`)}
                        className={ITEM_CLS}
                      >
                        <span className={cn(ICON_CLS, "text-indigo-400")}>
                          <Rocket className="h-4 w-4" strokeWidth={1.75} />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">
                            {p.name}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            Cliente: {p.clientName}
                          </div>
                        </div>
                      </Cmdk.Item>
                    ))}
                  </Cmdk.Group>
                </>
              )}

              {/* CRM: Tareas */}
              {results.tasks.length > 0 && (
                <>
                  {DIVIDER}
                  <Cmdk.Group heading="Tareas" className={GROUP_CLS}>
                    {results.tasks.map((t) => (
                      <Cmdk.Item
                        key={`task-${t.id}`}
                        value={normalize(
                          `tarea ${t.name} ${t.projectName} ${t.clientName}`
                        )}
                        onSelect={() =>
                          handleNavigate(
                            `/proyectos/${t.projectId}?tab=tareas`
                          )
                        }
                        className={ITEM_CLS}
                      >
                        <span className={cn(ICON_CLS, "text-emerald-400")}>
                          <CheckSquare
                            className="h-4 w-4"
                            strokeWidth={1.75}
                          />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">
                            {t.name}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {t.projectName} · {t.clientName}
                          </div>
                        </div>
                      </Cmdk.Item>
                    ))}
                  </Cmdk.Group>
                </>
              )}

              {/* CRM: VPS */}
              {results.vpsProjects.length > 0 && (
                <>
                  {DIVIDER}
                  <Cmdk.Group heading="VPS" className={GROUP_CLS}>
                    {results.vpsProjects.map((vp) => (
                      <Cmdk.Item
                        key={`vps-${vp.id}`}
                        value={normalize(
                          `vps ${vp.name} ${vp.domain ?? ""} ${vp.type}`
                        )}
                        onSelect={() => handleNavigate("/vps")}
                        className={ITEM_CLS}
                      >
                        <span className={cn(ICON_CLS, "text-orange-400")}>
                          <Server className="h-4 w-4" strokeWidth={1.75} />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">
                            {vp.name}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {vp.domain || "Sin dominio"} · {vp.type}
                          </div>
                        </div>
                      </Cmdk.Item>
                    ))}
                  </Cmdk.Group>
                </>
              )}
            </Cmdk.List>

            {/* Footer */}
            <div className="flex items-center gap-4 border-t border-border/60 px-4 py-2.5 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <kbd className="rounded border border-border bg-background/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  ↑↓
                </kbd>
                Navegar
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="rounded border border-border bg-background/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  ↵
                </kbd>
                Abrir
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="rounded border border-border bg-background/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  Esc
                </kbd>
                Cerrar
              </span>
              <span className="ml-auto flex items-center gap-1">
                <kbd className="rounded border border-border bg-background/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  ⌘K
                </kbd>
              </span>
            </div>
          </Cmdk>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
