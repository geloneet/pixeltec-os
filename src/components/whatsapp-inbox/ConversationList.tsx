"use client";

import { useMemo, useState } from "react";
import { Inbox, ListFilter, MessageCircle, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import {
  CLASSIFICATION_META,
  type InboxConversation,
  type WhatsAppContact,
} from "@/types/whatsapp-inbox";
import { EmptyState } from "./ui/EmptyState";
import { SemanticBadge } from "./ui/SemanticBadge";
import { formatRelative, MODE_META, resolveMode } from "./ui/meta";

/**
 * Nivel A — categoría del contacto ("¿qué tipo de contacto es?").
 * `sin_clasificar` agrupa classification ausente y también `otro` (no tiene
 * carpeta propia: en la práctica significa "sin categoría útil").
 */
export type CategoryId =
  | "todos"
  | "prospecto"
  | "cliente"
  | "soporte"
  | "proveedor"
  | "spam"
  | "sin_clasificar";

/** Nivel B — filtro operativo ("¿qué necesita atención ahora?"). */
export type QuickFilterId =
  | "sin_responder"
  | "bot_activo"
  | "control_humano"
  | "urgente"
  | "nuevo"
  | "archivados";

const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "prospecto", label: "Prospectos" },
  { id: "cliente", label: "Clientes" },
  { id: "soporte", label: "Soporte" },
  { id: "proveedor", label: "Proveedores" },
  { id: "spam", label: "Spam" },
  { id: "sin_clasificar", label: "Sin clasificar" },
];

/**
 * Los 6 filtros operativos previos se preservan íntegros; cambia solo la
 * presentación (§8.2): tres vistas rápidas siempre visibles y el resto
 * dentro del popover de Filtros.
 */
const QUICK_VIEWS: { id: QuickFilterId; label: string }[] = [
  { id: "sin_responder", label: "Sin responder" },
  { id: "control_humano", label: "Control humano" },
  { id: "urgente", label: "Urgentes" },
];

const POPOVER_FILTERS: { id: QuickFilterId; label: string }[] = [
  { id: "bot_activo", label: "Bot respondiendo" },
  { id: "nuevo", label: "Nuevo" },
  { id: "archivados", label: "Archivados" },
];

const QUICK_FILTER_LABELS: Record<QuickFilterId, string> = {
  sin_responder: "Sin responder",
  bot_activo: "Bot respondiendo",
  control_humano: "Control humano",
  urgente: "Urgentes",
  nuevo: "Nuevo",
  archivados: "Archivados",
};

function matchesCategory(category: CategoryId, contact: WhatsAppContact | undefined): boolean {
  if (category === "todos") return true;
  const classification = contact?.classification;
  if (category === "sin_clasificar") return !classification || classification === "otro";
  return classification === category;
}

/**
 * Filtro operativo. Salvo "archivados", todos operan sobre la bandeja viva
 * (excluyen archivados), igual que el comportamiento previo de "Todos".
 */
function matchesQuickFilter(
  filter: QuickFilterId | null,
  conv: InboxConversation,
  contact: WhatsAppContact | undefined
): boolean {
  const archived = contact?.status === "archivado";
  if (filter === "archivados") return archived;
  if (archived) return false;
  switch (filter) {
    case null:
      return true;
    case "sin_responder":
      return conv.lastMessageDirection === "inbound";
    case "bot_activo":
      return resolveMode(conv.mode) === "BOT";
    case "control_humano":
      return conv.mode === "HUMAN";
    case "urgente":
      return Boolean(contact?.urgent);
    case "nuevo":
      return !contact?.status || contact.status === "nuevo";
  }
}

function matchesSearch(
  q: string,
  conv: InboxConversation,
  contact: WhatsAppContact | undefined
): boolean {
  if (!q) return true;
  const classificationLabel = contact?.classification
    ? CLASSIFICATION_META[contact.classification]?.label ?? ""
    : "";
  const haystack = [
    conv.id,
    contact?.name ?? "",
    conv.lastMessagePreview ?? "",
    classificationLabel,
    ...(contact?.tags ?? []),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

interface ConversationListProps {
  tenantId: string;
  conversations: InboxConversation[];
  loading: boolean;
  error: string | null;
  contactsByPhone: Map<string, WhatsAppContact>;
  selectedPhone: string | null;
  onSelect: (phone: string) => void;
  category: CategoryId;
  onCategoryChange: (category: CategoryId) => void;
  quickFilter: QuickFilterId | null;
  onQuickFilterChange: (filter: QuickFilterId | null) => void;
}

export function ConversationList({
  conversations,
  loading,
  error,
  contactsByPhone,
  selectedPhone,
  onSelect,
  category,
  onCategoryChange,
  quickFilter,
  onQuickFilterChange,
}: ConversationListProps) {
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const q = search.trim().toLowerCase();

  // Conversaciones que pasan filtro operativo + búsqueda (la categoría se
  // aplica después): base para la lista Y para los contadores por categoría,
  // que así responden "¿cuántas verías en esta categoría con el filtro actual?".
  const operationalPool = useMemo(
    () =>
      (conversations ?? []).filter((conv) => {
        const contact = contactsByPhone.get(conv.id);
        return matchesQuickFilter(quickFilter, conv, contact) && matchesSearch(q, conv, contact);
      }),
    [conversations, contactsByPhone, quickFilter, q]
  );

  const categoryCounts = useMemo(() => {
    const counts = new Map<CategoryId, number>();
    for (const { id } of CATEGORIES) counts.set(id, 0);
    for (const conv of operationalPool) {
      const contact = contactsByPhone.get(conv.id);
      counts.set("todos", (counts.get("todos") ?? 0) + 1);
      for (const { id } of CATEGORIES) {
        if (id !== "todos" && matchesCategory(id, contact)) {
          counts.set(id, (counts.get(id) ?? 0) + 1);
        }
      }
    }
    return counts;
  }, [operationalPool, contactsByPhone]);

  const filteredConversations = useMemo(
    () =>
      operationalPool.filter((conv) => matchesCategory(category, contactsByPhone.get(conv.id))),
    [operationalPool, contactsByPhone, category]
  );

  const hasActiveFilters = category !== "todos" || quickFilter !== null || q !== "";
  // El botón Filtros gobierna categoría + filtros del popover; las vistas
  // rápidas tienen su propio estado visible.
  const popoverActiveCount =
    (category !== "todos" ? 1 : 0) +
    (quickFilter && POPOVER_FILTERS.some((f) => f.id === quickFilter) ? 1 : 0);

  function clearFilters() {
    onCategoryChange("todos");
    onQuickFilterChange(null);
    setSearch("");
  }

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Spinner size="md" className="text-muted-foreground" />
      </div>
    );
  }

  if (error && !conversations?.length) {
    return (
      <div className="p-4">
        <EmptyState
          icon={MessageCircle}
          tone="error"
          title="No pudimos cargar las conversaciones"
          description={error}
        />
      </div>
    );
  }

  if (!conversations?.length) {
    return (
      <div className="p-4">
        <EmptyState
          icon={Inbox}
          title="Sin conversaciones todavía"
          description="Cuando alguien le escriba a tu número de WhatsApp, la conversación aparecerá aquí y el bot empezará a atenderla."
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Error no bloqueante: pixelbot momentáneamente inalcanzable — se conserva
          la última lista conocida en vez de vaciar la pantalla (polling la reintenta solo). */}
      {error && (
        <div
          role="status"
          className="flex-shrink-0 border-b border-red-500/20 bg-red-500/5 px-4 py-1.5 text-xs text-red-700 dark:text-red-400"
        >
          No se pudo actualizar — mostrando la última lista conocida.
        </div>
      )}

      {/* Cabecera fija: título + búsqueda + vistas rápidas + Filtros */}
      <div className="flex-shrink-0 space-y-2.5 border-b border-border px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">
            Bandeja
            <span className="ml-2 text-xs font-normal tabular-nums text-muted-foreground">
              {filteredConversations.length}
            </span>
          </h2>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex-shrink-0 text-xs text-muted-foreground transition-colors hover:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
            >
              Limpiar
            </button>
          )}
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar conversación…"
            aria-label="Buscar por nombre, teléfono, mensaje, etiqueta o tipo"
            className="w-full rounded-lg border border-border bg-secondary/40 py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-cyan-500/50 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <div className="scrollbar-none flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
            {QUICK_VIEWS.map((view) => {
              const isActive = quickFilter === view.id;
              return (
                <button
                  key={view.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => onQuickFilterChange(isActive ? null : view.id)}
                  className={cn(
                    "flex-shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40",
                    isActive
                      ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {view.label}
                </button>
              );
            })}
          </div>

          <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={`Filtros${popoverActiveCount ? ` (${popoverActiveCount} activos)` : ""}`}
                className={cn(
                  "inline-flex flex-shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40",
                  popoverActiveCount > 0
                    ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                <ListFilter aria-hidden className="h-3.5 w-3.5" />
                Filtros
                {popoverActiveCount > 0 && (
                  <span className="tabular-nums">{popoverActiveCount}</span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 border-border bg-popover/95 p-3 backdrop-blur-xl">
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
                    Categoría
                  </p>
                  <div className="mt-1.5 grid grid-cols-2 gap-1">
                    {CATEGORIES.map((cat) => {
                      const isActive = category === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          aria-pressed={isActive}
                          onClick={() => onCategoryChange(cat.id)}
                          className={cn(
                            "flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-xs transition-colors",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40",
                            cat.id === "todos" && "col-span-2",
                            isActive
                              ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-700 dark:text-cyan-200"
                              : "border-transparent text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                          )}
                        >
                          <span className="truncate">{cat.label}</span>
                          <span className="flex-shrink-0 text-xs tabular-nums text-muted-foreground/60">
                            {categoryCounts.get(cat.id) ?? 0}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
                    Estado
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {POPOVER_FILTERS.map((filter) => {
                      const isActive = quickFilter === filter.id;
                      return (
                        <button
                          key={filter.id}
                          type="button"
                          aria-pressed={isActive}
                          onClick={() => onQuickFilterChange(isActive ? null : filter.id)}
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-xs transition-colors",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40",
                            isActive
                              ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300"
                              : "border-border text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {filter.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={() => {
                      clearFilters();
                      setFiltersOpen(false);
                    }}
                    className="w-full rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Chips de filtros activos que no se ven en las vistas rápidas */}
        {(category !== "todos" ||
          (quickFilter && POPOVER_FILTERS.some((f) => f.id === quickFilter))) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {category !== "todos" && (
              <button
                type="button"
                onClick={() => onCategoryChange("todos")}
                className="inline-flex items-center gap-1 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 text-xs text-cyan-700 transition-colors hover:bg-cyan-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 dark:text-cyan-300"
              >
                {CATEGORIES.find((c) => c.id === category)?.label}
                <X aria-hidden className="h-3 w-3" />
                <span className="sr-only">Quitar filtro de categoría</span>
              </button>
            )}
            {quickFilter && POPOVER_FILTERS.some((f) => f.id === quickFilter) && (
              <button
                type="button"
                onClick={() => onQuickFilterChange(null)}
                className="inline-flex items-center gap-1 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 text-xs text-cyan-700 transition-colors hover:bg-cyan-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 dark:text-cyan-300"
              >
                {QUICK_FILTER_LABELS[quickFilter]}
                <X aria-hidden className="h-3 w-3" />
                <span className="sr-only">Quitar filtro de estado</span>
              </button>
            )}
          </div>
        )}
      </div>

      <ul className="scrollbar-soft min-h-0 flex-1 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="space-y-2 p-6 text-center text-sm text-muted-foreground">
            <p>No hay conversaciones con estos filtros.</p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-border hover:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const contact = contactsByPhone.get(conv.id);
            const mode = MODE_META[resolveMode(conv.mode)];
            const isSelected = conv.id === selectedPhone;
            const hasInboundLast = conv.lastMessageDirection === "inbound";
            const initial = contact?.name?.trim().charAt(0).toUpperCase();

            // Máximo dos indicadores persistentes por fila (§8.2): el modo
            // siempre, más el extra de mayor prioridad.
            const extraBadge = contact?.urgent
              ? { label: "Urgente", className: "text-red-700 dark:text-red-300 bg-red-500/10 border-red-500/30" }
              : !contact?.status || contact.status === "nuevo"
                ? { label: "Nuevo", className: "text-sky-700 dark:text-sky-300 bg-sky-500/10 border-sky-500/30" }
                : contact?.classification && CLASSIFICATION_META[contact.classification]
                  ? {
                      label: CLASSIFICATION_META[contact.classification].label,
                      className: CLASSIFICATION_META[contact.classification].className,
                    }
                  : null;

            return (
              <li key={conv.id}>
                <button
                  type="button"
                  onClick={() => onSelect(conv.id)}
                  aria-current={isSelected || undefined}
                  className={cn(
                    "relative flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-400/40",
                    isSelected ? "bg-secondary/70" : "hover:bg-secondary/40"
                  )}
                >
                  {isSelected && (
                    <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-cyan-400" />
                  )}

                  <span
                    aria-hidden
                    className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-border bg-secondary/60 text-sm font-semibold text-muted-foreground"
                  >
                    {initial ?? <MessageCircle className="h-4 w-4" />}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {hasInboundLast && (
                        <span
                          aria-label="Último mensaje del cliente"
                          className="h-2 w-2 flex-shrink-0 rounded-full bg-cyan-400"
                        />
                      )}
                      <span
                        className={cn(
                          "truncate text-sm text-foreground",
                          (conv.unreadCount ?? 0) > 0 ? "font-semibold" : "font-medium"
                        )}
                      >
                        {contact?.name ?? conv.id}
                      </span>
                      <span className="ml-auto flex-shrink-0 text-xs text-muted-foreground">
                        {formatRelative(conv.lastMessageAt)}
                      </span>
                      {(conv.unreadCount ?? 0) > 0 && (
                        <span
                          aria-label={`${conv.unreadCount} no leídos`}
                          className="flex-shrink-0 rounded-full bg-cyan-500 px-1.5 py-0.5 text-xs font-semibold leading-none text-white"
                        >
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {conv.lastMessagePreview ?? ""}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      <SemanticBadge
                        label={mode.shortLabel}
                        title={mode.label}
                        icon={mode.icon}
                        className={mode.className}
                      />
                      {extraBadge && (
                        <SemanticBadge label={extraBadge.label} className={extraBadge.className} />
                      )}
                    </div>
                  </div>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
