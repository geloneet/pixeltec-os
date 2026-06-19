"use client";

import { useState, useMemo } from "react";
import type { CRMClient } from "@/types/crm";
import {
  deriveClientStats,
  clientBadge,
  type ClientStats,
  type ClientBadge,
} from "@/lib/crm/client-stats";
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
import { Users, FolderKanban, ListTodo, Search, MoreHorizontal } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
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

function formatSince(dateStr: string): string {
  try {
    return format(new Date(dateStr), "MMM yyyy", { locale: es });
  } catch {
    return "—";
  }
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
  since: string;
}

// ── ClientRow ─────────────────────────────────────────────────────────────────

interface ClientRowProps {
  item: ClientItem;
  navigateToClient: (id: string) => void;
  setModal: (m: { type: string; data?: Record<string, string> } | null) => void;
}

function ClientRow({ item, navigateToClient, setModal }: ClientRowProps) {
  const { client: c, stats, badge, since } = item;
  const color = avatarColor(c.name);
  const contact = [c.location, c.phone].filter(Boolean).join(" · ");

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigateToClient(c.id)}
      onKeyDown={(e) => { if (e.key === "Enter") navigateToClient(c.id); }}
      className="group flex items-center rounded-xl border border-white/[0.06] bg-zinc-900/20 cursor-pointer transition-all duration-150 hover:border-cyan-400/30 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
    >
      {/* Identity */}
      <div className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3">
        <span
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
          style={{ backgroundColor: color }}
        >
          {initials(c.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-snug text-zinc-100">{c.name}</p>
          <p className="truncate text-[11px] leading-snug text-zinc-500">
            {contact || <span className="italic text-zinc-700">Sin datos de contacto</span>}
          </p>
        </div>
      </div>

      {/* Badge */}
      <div className="flex-shrink-0 px-3 py-3">
        <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold", badge.colorClass)}>
          {badge.label}
        </span>
      </div>

      <div className="my-2 w-px self-stretch bg-white/[0.06]" />

      {/* Projects */}
      <div className="w-20 flex-shrink-0 px-3 py-3 text-center">
        <p className="tabular-nums text-sm font-semibold text-zinc-100">{stats.projectsCount}</p>
        <p className="mt-0.5 text-[10px] text-zinc-600">proyectos</p>
      </div>

      <div className="my-2 w-px self-stretch bg-white/[0.06]" />

      {/* Tasks */}
      <div className="w-28 flex-shrink-0 px-3 py-3 text-center">
        {stats.totalTasks > 0 ? (
          <>
            <p className="tabular-nums text-sm font-semibold text-zinc-100">{stats.openTasks}</p>
            <p className="mt-0.5 text-[10px] text-zinc-600">abiertas / {stats.totalTasks}</p>
          </>
        ) : (
          <>
            <p className="text-sm text-zinc-700">—</p>
            <p className="mt-0.5 text-[10px] text-zinc-700">tareas</p>
          </>
        )}
      </div>

      <div className="my-2 w-px self-stretch bg-white/[0.06]" />

      {/* Since */}
      <div className="w-24 flex-shrink-0 px-3 py-3 text-center">
        <p className="text-[11px] font-medium capitalize text-zinc-400">{since}</p>
        <p className="mt-0.5 text-[10px] text-zinc-600">cliente desde</p>
      </div>

      <div className="my-2 w-px self-stretch bg-white/[0.06]" />

      {/* Progress */}
      <div className="w-28 flex-shrink-0 px-4 py-3">
        {stats.totalTasks > 0 ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="tabular-nums text-[10px] font-medium text-zinc-400">{stats.pct}%</span>
              <span className="text-[10px] text-zinc-600">avance</span>
            </div>
            <div className="h-[3px] w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={cn("h-full rounded-full transition-all", stats.pct >= 100 ? "bg-green-500" : "bg-cyan-500")}
                style={{ width: `${stats.pct}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="text-[11px] text-zinc-700">—</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div
        className="flex-shrink-0 px-3 py-3"
        onClick={(e) => e.stopPropagation()}
        role="presentation"
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 opacity-0 transition-opacity hover:bg-white/[0.06] hover:text-zinc-300 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none"
              aria-label={`Acciones para ${c.name}`}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 border-zinc-800/60 bg-zinc-900/95 backdrop-blur-xl">
            <DropdownMenuItem
              className="cursor-pointer text-sm text-zinc-300 focus:bg-white/[0.06] focus:text-zinc-100"
              onSelect={() => navigateToClient(c.id)}
            >
              Ver cliente
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer text-sm text-zinc-300 focus:bg-white/[0.06] focus:text-zinc-100"
              onSelect={() =>
                setModal({
                  type: "editClient",
                  data: {
                    id: c.id,
                    name: c.name,
                    email: c.email,
                    phone: c.phone,
                    location: c.location,
                    notes: c.notes,
                  },
                })
              }
            >
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer text-sm text-zinc-300 focus:bg-white/[0.06] focus:text-zinc-100"
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

  const allItems = useMemo<ClientItem[]>(() =>
    clients.map(c => {
      const stats = deriveClientStats(c);
      return { client: c, stats, badge: clientBadge(stats), since: formatSince(c.createdAt) };
    }),
    [clients]
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
          <h2 className="text-xl font-semibold text-zinc-100">Clientes</h2>
          <p className="text-sm text-zinc-500">Directorio de cuentas activas</p>
        </div>
        <button
          onClick={() => setModal({ type: "addClient" })}
          className="flex-shrink-0 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-300 transition-all duration-150 hover:bg-cyan-500/20"
        >
          + Cliente
        </button>
      </div>

      {/* Global metrics */}
      {clients.length > 0 && (
        <div className="mb-5 flex items-center gap-5 text-sm">
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-cyan-400" strokeWidth={1.75} />
            <span className="tabular-nums font-semibold text-zinc-100">{metrics.totalClients}</span>
            <span className="text-zinc-500">clientes</span>
          </span>
          <span className="text-zinc-700">·</span>
          <span className="flex items-center gap-1.5">
            <FolderKanban className="h-3.5 w-3.5 text-cyan-400" strokeWidth={1.75} />
            <span className="tabular-nums font-semibold text-zinc-100">{metrics.totalProjects}</span>
            <span className="text-zinc-500">proyectos</span>
          </span>
          <span className="text-zinc-700">·</span>
          <span className="flex items-center gap-1.5">
            <ListTodo className="h-3.5 w-3.5 text-cyan-400" strokeWidth={1.75} />
            <span className="tabular-nums font-semibold text-zinc-100">{metrics.totalOpenTasks}</span>
            <span className="text-zinc-500">tareas abiertas</span>
          </span>
        </div>
      )}

      {/* Action bar */}
      {clients.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-48 max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
            <Input
              placeholder="Buscar cliente…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-8 border-white/[0.08] bg-zinc-900/40 pl-9 text-sm text-zinc-300 placeholder:text-zinc-600 focus-visible:border-cyan-500/40 focus-visible:ring-cyan-500/20"
            />
          </div>

          <div className="flex items-center gap-0.5 rounded-lg border border-white/[0.06] p-0.5">
            {FILTERS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-all duration-150",
                  filter === key
                    ? "border border-cyan-500/20 bg-cyan-500/15 text-cyan-300"
                    : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="h-8 w-44 border-white/[0.08] bg-zinc-900/40 text-xs text-zinc-400 focus:ring-cyan-500/20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-zinc-800/60 bg-zinc-900/95 backdrop-blur-xl">
              <SelectItem value="recientes" className="text-sm text-zinc-300 focus:bg-white/[0.06] focus:text-zinc-100">Más recientes</SelectItem>
              <SelectItem value="nombre" className="text-sm text-zinc-300 focus:bg-white/[0.06] focus:text-zinc-100">Nombre A–Z</SelectItem>
              <SelectItem value="mas-proyectos" className="text-sm text-zinc-300 focus:bg-white/[0.06] focus:text-zinc-100">Más proyectos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* List */}
      {clients.length === 0 ? (
        <p className="py-20 text-center text-sm text-zinc-500">No hay clientes aún</p>
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-zinc-500">
          Sin resultados para{" "}
          <span className="text-zinc-400">&ldquo;{query}&rdquo;</span>
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
