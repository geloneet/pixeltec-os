"use client";

import { useState, useMemo } from "react";
import type { CRMClient } from "@/types/crm";
import {
  deriveClientStats,
  clientStatusBadge,
  formatPhone,
  type ClientStats,
  type ClientBadge,
  type ActionablePhone,
} from "@/lib/crm/client-stats";
import {
  nextActionChip,
  activeProjectsInfo,
  type NextActionChip,
  type ActiveProjectsInfo,
} from "@/lib/crm/clients-list-logic";
import { Input } from "@/components/ui/input";
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
  ListTodo,
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

type FilterKey = "todos" | "con-tareas" | "sin-tareas" | "activos";
type SortKey = "recientes" | "nombre" | "mas-proyectos";

interface ClientsViewProps {
  clients: CRMClient[];
  navigateToClient: (id: string) => void;
  setModal: (m: { type: string; data?: Record<string, string> } | null) => void;
}

interface ClientItem {
  client: CRMClient;
  stats: ClientStats;
  badge: ClientBadge;
  nextChip: NextActionChip;
  projects: ActiveProjectsInfo;
  phone: ActionablePhone | null;
}

// ── ClientRow ─────────────────────────────────────────────────────────────────

interface ClientRowProps {
  item: ClientItem;
  navigateToClient: (id: string) => void;
  setModal: (m: { type: string; data?: Record<string, string> } | null) => void;
}

function ClientRow({ item, navigateToClient, setModal }: ClientRowProps) {
  const { client: c, badge, nextChip, projects, phone } = item;
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

      {/* Última actividad (A2 la llena) */}
      <div className="md:text-center">
        <p className="text-[11px] font-medium text-muted-foreground">—</p>
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

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "con-tareas", label: "Con tareas" },
  { key: "sin-tareas", label: "Sin tareas" },
  { key: "activos", label: "Activos" },
];

// ── ClientsView ───────────────────────────────────────────────────────────────

export function ClientsView({ clients, navigateToClient, setModal }: ClientsViewProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("todos");
  const [sort, setSort] = useState<SortKey>("recientes");

  const now = useMemo(() => new Date(), []);

  const allItems = useMemo<ClientItem[]>(() =>
    clients.map(c => {
      const stats = deriveClientStats(c);
      return {
        client: c,
        stats,
        badge: clientStatusBadge(c.crmStatus, stats),
        nextChip: nextActionChip(c.nextAction, now),
        projects: activeProjectsInfo(c),
        phone: formatPhone(c.phone),
      };
    }),
    [clients, now]
  );

  const metrics = useMemo(() => ({
    totalClients: clients.length,
    totalProjects: allItems.reduce((s, { stats }) => s + stats.projectsCount, 0),
    totalOpenTasks: allItems.reduce((s, { stats }) => s + stats.openTasks, 0),
  }), [clients.length, allItems]);

  const filtered = useMemo(() => {
    let result = allItems;

    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter(({ client: c }) =>
        c.name.toLowerCase().includes(q) ||
        (c.contactName?.toLowerCase().includes(q) ?? false) ||
        c.location.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
      );
    }

    if (filter === "con-tareas") result = result.filter(({ stats }) => stats.openTasks > 0);
    else if (filter === "sin-tareas") result = result.filter(({ stats }) => stats.openTasks === 0);
    else if (filter === "activos") result = result.filter(({ stats }) => stats.projectsCount > 0);

    const sorted = [...result];
    if (sort === "nombre") {
      sorted.sort((a, b) => a.client.name.localeCompare(b.client.name, "es"));
    } else if (sort === "mas-proyectos") {
      sorted.sort((a, b) => b.stats.projectsCount - a.stats.projectsCount);
    } else {
      sorted.sort((a, b) =>
        new Date(b.client.createdAt).getTime() - new Date(a.client.createdAt).getTime()
      );
    }

    return sorted;
  }, [allItems, query, filter, sort]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Clientes</h2>
          <p className="text-sm text-muted-foreground">Directorio de cuentas activas</p>
        </div>
        <button
          onClick={() => setModal({ type: "addClient" })}
          className="flex-shrink-0 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-700 dark:text-cyan-300 transition-all duration-150 hover:bg-cyan-500/20"
        >
          + Cliente
        </button>
      </div>

      {/* Global metrics */}
      {clients.length > 0 && (
        <div className="mb-5 flex items-center gap-5 text-sm">
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-cyan-400" strokeWidth={1.75} />
            <span className="tabular-nums font-semibold text-foreground">{metrics.totalClients}</span>
            <span className="text-muted-foreground">clientes</span>
          </span>
          <span className="text-muted-foreground/50">·</span>
          <span className="flex items-center gap-1.5">
            <FolderKanban className="h-3.5 w-3.5 text-cyan-400" strokeWidth={1.75} />
            <span className="tabular-nums font-semibold text-foreground">{metrics.totalProjects}</span>
            <span className="text-muted-foreground">proyectos</span>
          </span>
          <span className="text-muted-foreground/50">·</span>
          <span className="flex items-center gap-1.5">
            <ListTodo className="h-3.5 w-3.5 text-cyan-400" strokeWidth={1.75} />
            <span className="tabular-nums font-semibold text-foreground">{metrics.totalOpenTasks}</span>
            <span className="text-muted-foreground">tareas abiertas</span>
          </span>
        </div>
      )}

      {/* Action bar */}
      {clients.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-48 max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-8 border-border bg-muted/40 pl-9 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-cyan-500/40 focus-visible:ring-cyan-500/20"
            />
          </div>

          <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
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

          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="h-8 w-44 border-border bg-muted/40 text-xs text-muted-foreground focus:ring-cyan-500/20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-border bg-popover/95 backdrop-blur-xl">
              <SelectItem value="recientes" className="text-sm text-muted-foreground focus:bg-accent focus:text-foreground">Más recientes</SelectItem>
              <SelectItem value="nombre" className="text-sm text-muted-foreground focus:bg-accent focus:text-foreground">Nombre A–Z</SelectItem>
              <SelectItem value="mas-proyectos" className="text-sm text-muted-foreground focus:bg-accent focus:text-foreground">Más proyectos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* List */}
      {clients.length === 0 ? (
        <p className="py-20 text-center text-sm text-muted-foreground">No hay clientes aún</p>
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Sin resultados para{" "}
          <span className="text-foreground">&ldquo;{query}&rdquo;</span>
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
