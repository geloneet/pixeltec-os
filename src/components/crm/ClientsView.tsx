"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { CRMClient } from "@/types/crm";
import {
  deriveClientStats,
  clientStatusBadge,
  formatPhone,
  type ClientBadge,
  type ActionablePhone,
} from "@/lib/crm/client-stats";
import {
  nextActionChip,
  activeProjectsInfo,
  clientNeedsAttention,
  syntheticLastActivity,
  lastActivityLabel,
  matchesClientQuery,
  applyClientsFilter,
  sortClientsEntries,
  deriveDirectoryMetrics,
  parseClientsFilter,
  parseClientsSort,
  type NextActionChip,
  type ActiveProjectsInfo,
  type ClientListEntry,
  type ClientsFilter,
  type ClientsSort,
} from "@/lib/crm/clients-list-logic";
import { getClientListSignalsAction } from "@/components/crm/crm-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Users,
  FolderKanban,
  AlertTriangle,
  Search,
  MoreHorizontal,
  Phone,
  MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "#0EA5E9", "#3b82f6", "#ef4444", "#f59e0b",
  "#10b981", "#ec4899", "#8b5cf6", "#06b6d4",
];

function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ClientsViewProps {
  clients: CRMClient[];
  navigateToClient: (id: string) => void;
  setModal: (m: { type: string; data?: Record<string, string> } | null) => void;
}

interface ClientItem extends ClientListEntry {
  badge: ClientBadge;
  nextChip: NextActionChip;
  projects: ActiveProjectsInfo;
  phone: ActionablePhone | null;
  lastLabel: string;
}

// ── ClientRow ─────────────────────────────────────────────────────────────────

interface ClientRowProps {
  item: ClientItem;
  navigateToClient: (id: string) => void;
  setModal: (m: { type: string; data?: Record<string, string> } | null) => void;
}

function ClientRow({ item, navigateToClient, setModal }: ClientRowProps) {
  const { client: c, badge, nextChip, projects, phone, lastLabel } = item;
  const color = avatarColor(c.name);
  const meta = [c.contactName, c.location, phone?.display ?? (c.phone || null)]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Abrir cliente ${c.name}`}
      onClick={() => navigateToClient(c.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigateToClient(c.id);
        }
      }}
      className="group flex cursor-pointer flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-all duration-150 hover:border-cyan-400/30 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 dark:bg-zinc-900/20 dark:shadow-none md:grid md:grid-cols-[minmax(0,1fr)_8.5rem_11rem_6.5rem_7rem_5.5rem] md:items-center md:gap-3 md:px-4 md:py-3"
    >
      {/* Identity */}
      <div className="flex min-w-0 items-center gap-3">
        <span
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
          style={{ backgroundColor: color }}
        >
          {initials(c.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-snug text-foreground">{c.name}</p>
          <p className="truncate text-[11px] leading-snug text-muted-foreground">
            {meta || <span className="italic text-muted-foreground/60">Sin datos de contacto</span>}
          </p>
        </div>
      </div>

      {/* Badge */}
      <div className="md:justify-self-start">
        <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold", badge.colorClass)}>
          {badge.label}
        </span>
      </div>

      {/* Próxima acción */}
      <div className="min-w-0">
        {nextChip.tone === "muted" ? (
          <p className="text-[11px] text-muted-foreground/60">{nextChip.label}</p>
        ) : (
          <>
            <p className="truncate text-[11px] font-medium text-foreground">{nextChip.label}</p>
            {nextChip.detail && (
              <p
                className={cn(
                  "mt-0.5 truncate text-[10px]",
                  nextChip.tone === "overdue"
                    ? "font-semibold text-red-600 dark:text-red-400"
                    : "text-muted-foreground/70"
                )}
              >
                {nextChip.detail}
              </p>
            )}
          </>
        )}
        <p className="mt-0.5 text-[10px] text-muted-foreground/50 md:hidden">próxima acción</p>
      </div>

      {/* Proyectos activos */}
      <div className="md:text-center">
        {projects.hasProjects ? (
          <p className="tabular-nums text-sm font-semibold text-foreground">{projects.label}</p>
        ) : (
          <p className="text-[11px] text-muted-foreground/60">{projects.label}</p>
        )}
        <p className="mt-0.5 text-[10px] text-muted-foreground/70">proyectos</p>
      </div>

      {/* Última actividad */}
      <div className="md:text-center">
        <p className="truncate text-[11px] font-medium text-muted-foreground">{lastLabel}</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground/70">última actividad</p>
      </div>

      {/* Actions */}
      <div
        className="flex items-center gap-1 md:justify-end"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="presentation"
      >
        {phone && (
          <>
            <a
              href={phone.telHref}
              aria-label={`Llamar a ${c.name}`}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-all hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none md:opacity-0 md:group-hover:opacity-100"
            >
              <Phone className="h-3.5 w-3.5" aria-hidden />
            </a>
            <a
              href={phone.waHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Abrir WhatsApp con ${c.name}`}
              className="flex h-7 w-7 items-center justify-center rounded-md text-green-600 transition-all hover:bg-accent hover:text-green-500 focus-visible:opacity-100 focus-visible:outline-none dark:text-green-500 dark:hover:text-green-400 md:opacity-0 md:group-hover:opacity-100"
            >
              <MessageCircle className="h-3.5 w-3.5" aria-hidden />
            </a>
          </>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-all hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none md:opacity-0 md:group-hover:opacity-100"
              aria-label={`Acciones para ${c.name}`}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 border-border bg-popover/95 backdrop-blur-xl">
            <DropdownMenuItem
              className="cursor-pointer text-sm text-muted-foreground focus:bg-accent focus:text-foreground"
              onSelect={() => navigateToClient(c.id)}
            >
              Ver cliente
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer text-sm text-muted-foreground focus:bg-accent focus:text-foreground"
              onSelect={() =>
                setModal({
                  type: "editClient",
                  data: {
                    id: c.id,
                    name: c.name,
                    contactName: c.contactName ?? "",
                    email: c.email,
                    phone: c.phone,
                    location: c.location,
                    notes: c.notes,
                    // Espejo de editClientModalData en ClientDetail: sin esto
                    // el modal degradaba el estado comercial a «prospecto».
                    crmStatus: c.crmStatus ?? "prospecto",
                  },
                })
              }
            >
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer text-sm text-muted-foreground focus:bg-accent focus:text-foreground"
              onSelect={() => navigateToClient(c.id)}
            >
              + Proyecto nuevo
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ── Filters config ────────────────────────────────────────────────────────────

const FILTERS: { key: ClientsFilter; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "atencion", label: "Requieren atención" },
  { key: "sin-proyecto", label: "Sin proyecto" },
  { key: "archivados", label: "Archivados" },
];

// ── ClientsView ───────────────────────────────────────────────────────────────

export function ClientsView({ clients, navigateToClient, setModal }: ClientsViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Estado inicial desde la URL (filtro/búsqueda/orden persisten al recargar
  // o compartir el enlace); después la URL se mantiene con router.replace.
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [filter, setFilter] = useState<ClientsFilter>(() => parseClientsFilter(searchParams.get("filtro")));
  const [sort, setSort] = useState<ClientsSort>(() => parseClientsSort(searchParams.get("orden")));

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    const apply = (key: string, value: string, defaultValue: string) => {
      if (value && value !== defaultValue) params.set(key, value);
      else params.delete(key);
    };
    apply("q", query.trim(), "");
    apply("filtro", filter, "todos");
    apply("orden", sort, "atencion");
    const next = params.toString();
    if (next !== searchParams.toString()) {
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    }
  }, [query, filter, sort, pathname, router, searchParams]);

  // Última actividad real (client_activity, agregada por owner): una sola
  // llamada al montar; los clientes sin fila usan el fallback sintético.
  const [signals, setSignals] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    getClientListSignalsAction()
      .then((map) => { if (alive) setSignals(map); })
      .catch(() => { /* fallback sintético ya cubre la columna */ });
    return () => { alive = false; };
  }, []);

  const now = useMemo(() => new Date(), []);

  const allItems = useMemo<ClientItem[]>(() =>
    clients.map(c => {
      const stats = deriveClientStats(c);
      const lastActivityAt = signals[c.id] ?? syntheticLastActivity(c);
      return {
        client: c,
        stats,
        attention: clientNeedsAttention(c, stats, now),
        lastActivityAt,
        badge: clientStatusBadge(c.crmStatus, stats),
        nextChip: nextActionChip(c.nextAction, now),
        projects: activeProjectsInfo(c),
        phone: formatPhone(c.phone),
        lastLabel: lastActivityLabel(lastActivityAt, now),
      };
    }),
    [clients, signals, now]
  );

  const metrics = useMemo(() => deriveDirectoryMetrics(allItems), [allItems]);

  const filtered = useMemo(() => {
    const byQuery = allItems.filter((item) => matchesClientQuery(item.client, query));
    return sortClientsEntries(applyClientsFilter(byQuery, filter), sort);
  }, [allItems, query, filter, sort]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Clientes</h2>
          <p className="text-sm text-muted-foreground">Directorio de cuentas activas</p>
        </div>
        <Button className="flex-shrink-0" onClick={() => setModal({ type: "addClient" })}>
          Nuevo cliente
        </Button>
      </div>

      {/* Global metrics (cada cifra aplica su filtro) */}
      {clients.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <button
            onClick={() => setFilter("todos")}
            className="flex items-center gap-1.5 rounded-md px-1.5 py-0.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
            aria-label="Ver todos los clientes"
          >
            <Users className="h-3.5 w-3.5 text-cyan-400" strokeWidth={1.75} />
            <span className="tabular-nums font-semibold text-foreground">{metrics.activeClients}</span>
            <span className="text-muted-foreground">clientes activos</span>
          </button>
          <span className="text-muted-foreground/50">·</span>
          <button
            onClick={() => setFilter("todos")}
            className="flex items-center gap-1.5 rounded-md px-1.5 py-0.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
            aria-label="Ver clientes con proyectos activos"
          >
            <FolderKanban className="h-3.5 w-3.5 text-cyan-400" strokeWidth={1.75} />
            <span className="tabular-nums font-semibold text-foreground">{metrics.activeProjects}</span>
            <span className="text-muted-foreground">proyectos activos</span>
          </button>
          <span className="text-muted-foreground/50">·</span>
          <button
            onClick={() => setFilter("atencion")}
            className="flex items-center gap-1.5 rounded-md px-1.5 py-0.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
            aria-label="Ver clientes que requieren atención"
          >
            <AlertTriangle
              className={cn("h-3.5 w-3.5", metrics.attention > 0 ? "text-red-500" : "text-cyan-400")}
              strokeWidth={1.75}
            />
            <span
              className={cn(
                "tabular-nums font-semibold",
                metrics.attention > 0 ? "text-red-600 dark:text-red-400" : "text-foreground"
              )}
            >
              {metrics.attention}
            </span>
            <span className="text-muted-foreground">requieren atención</span>
          </button>
        </div>
      )}

      {/* Action bar */}
      {clients.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-48 max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente o proyecto…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-8 border-border bg-muted/40 pl-9 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-cyan-500/40 focus-visible:ring-cyan-500/20"
            />
          </div>

          <div className="flex flex-wrap items-center gap-0.5 rounded-lg border border-border p-0.5">
            {FILTERS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-all duration-150",
                  filter === key
                    ? "border border-cyan-500/20 bg-cyan-500/15 text-cyan-700 dark:text-cyan-300"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <Select value={sort} onValueChange={(v) => setSort(v as ClientsSort)}>
            <SelectTrigger className="h-8 w-44 border-border bg-muted/40 text-xs text-muted-foreground focus:ring-cyan-500/20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-border bg-popover/95 backdrop-blur-xl">
              <SelectItem value="atencion" className="text-sm text-muted-foreground focus:bg-accent focus:text-foreground">Atención primero</SelectItem>
              <SelectItem value="actividad" className="text-sm text-muted-foreground focus:bg-accent focus:text-foreground">Actividad reciente</SelectItem>
              <SelectItem value="nuevos" className="text-sm text-muted-foreground focus:bg-accent focus:text-foreground">Nuevos primero</SelectItem>
              <SelectItem value="nombre" className="text-sm text-muted-foreground focus:bg-accent focus:text-foreground">Nombre A–Z</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* List */}
      {clients.length === 0 ? (
        <p className="py-20 text-center text-sm text-muted-foreground">No hay clientes aún</p>
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {query.trim() ? (
            <>
              Sin resultados para{" "}
              <span className="text-foreground">&ldquo;{query}&rdquo;</span>
            </>
          ) : (
            "Sin clientes en este filtro"
          )}
        </p>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((item) => (
            <ClientRow
              key={item.client.id}
              item={item}
              navigateToClient={navigateToClient}
              setModal={setModal}
            />
          ))}
        </div>
      )}
    </div>
  );
}
