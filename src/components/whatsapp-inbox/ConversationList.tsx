"use client";

import { useMemo, useState } from "react";
import { Bot, Hand, LoaderCircle, PauseCircle, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseCanonical } from "@/lib/whatsapp-inbox/time";
import {
  CLASSIFICATION_META,
  type InboxConversation,
  type WhatsAppContact,
  type WhatsAppMode,
} from "@/types/whatsapp-inbox";

const MODE_META: Record<WhatsAppMode, { label: string; icon: typeof Bot; className: string }> = {
  BOT: { label: "Bot", icon: Bot, className: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30" },
  HUMAN: { label: "Tú", icon: Hand, className: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  PAUSED: { label: "Pausa", icon: PauseCircle, className: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
};

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

const QUICK_FILTERS: { id: QuickFilterId; label: string }[] = [
  { id: "sin_responder", label: "Sin responder" },
  { id: "bot_activo", label: "Bot activo" },
  { id: "control_humano", label: "Control humano" },
  { id: "urgente", label: "Urgente" },
  { id: "nuevo", label: "Nuevo" },
  { id: "archivados", label: "Archivados" },
];

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
      return (conv.mode ?? "BOT") === "BOT";
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

function formatRelative(canonical?: string): string {
  if (!canonical) return "";
  const date = parseCanonical(canonical);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return date.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
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

  const q = search.trim().toLowerCase();

  // Conversaciones que pasan filtro operativo + búsqueda (la categoría se
  // aplica después): base para la lista Y para los contadores por carpeta,
  // que así responden "¿cuántas verías en esta carpeta con el filtro actual?".
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

  function clearFilters() {
    onCategoryChange("todos");
    onQuickFilterChange(null);
    setSearch("");
  }

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <LoaderCircle className="h-5 w-5 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (error && !conversations?.length) {
    return (
      <div className="p-4 text-sm text-red-400">
        Error cargando conversaciones: {error}
      </div>
    );
  }

  if (!conversations?.length) {
    return (
      <div className="p-6 text-center text-sm text-zinc-500">
        Sin conversaciones todavía. Cuando alguien le escriba al bot, aparecerá aquí.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Error no bloqueante: pixelbot momentáneamente inalcanzable — se conserva
          la última lista conocida en vez de vaciar la pantalla (polling la reintenta solo). */}
      {error && (
        <div className="flex-shrink-0 border-b border-red-500/20 bg-red-500/5 px-4 py-1.5 text-[11px] text-red-400">
          No se pudo actualizar — mostrando la última lista conocida.
        </div>
      )}
      {/* Cabecera fija: título + búsqueda + carpetas + filtros rápidos */}
      <div className="flex-shrink-0 space-y-2.5 border-b border-zinc-800/60 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            WhatsApp — {filteredConversations.length} conversación
            {filteredConversations.length === 1 ? "" : "es"}
          </h1>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex-shrink-0 text-[11px] text-zinc-500 transition-colors hover:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, teléfono, mensaje, etiqueta o tipo…"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 py-2 pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500/50 focus:outline-none"
          />
        </div>

        {/* Nivel A: carpetas por tipo de contacto */}
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
            Contactos
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
                      ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-200"
                      : "border-transparent text-zinc-400 hover:bg-zinc-900/70 hover:text-zinc-200"
                  )}
                >
                  <span className="truncate">{cat.label}</span>
                  <span
                    className={cn(
                      "flex-shrink-0 text-[10px] tabular-nums",
                      isActive ? "text-cyan-300/80" : "text-zinc-600"
                    )}
                  >
                    {categoryCounts.get(cat.id) ?? 0}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Nivel B: filtros operativos — scroll horizontal con fades laterales */}
        <div className="relative">
          <div className="scrollbar-none flex items-center gap-1.5 overflow-x-auto whitespace-nowrap px-0.5">
            {QUICK_FILTERS.map((filter) => {
              const isActive = quickFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => onQuickFilterChange(isActive ? null : filter.id)}
                  className={cn(
                    "flex-shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40",
                    isActive
                      ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-300"
                      : "border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                  )}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-[#030303] to-transparent"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-3 bg-gradient-to-l from-[#030303] to-transparent"
          />
        </div>
      </div>

      <ul className="scrollbar-soft min-h-0 flex-1 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="space-y-2 p-6 text-center text-sm text-zinc-500">
            <p>No hay conversaciones con estos filtros.</p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-md border border-zinc-800 px-2.5 py-1 text-xs text-zinc-400 transition-colors hover:border-zinc-700 hover:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const contact = contactsByPhone.get(conv.id);
            const mode = MODE_META[conv.mode ?? "BOT"];
            const ModeIcon = mode.icon;
            const isSelected = conv.id === selectedPhone;
            const hasInboundLast = conv.lastMessageDirection === "inbound";

            const extraBadges: { key: string; label: string; className: string }[] = [];
            if (contact?.urgent) {
              extraBadges.push({
                key: "urgent",
                label: "Urgente",
                className: "text-red-300 bg-red-500/10 border-red-500/30",
              });
            }
            if (!contact?.status || contact.status === "nuevo") {
              extraBadges.push({
                key: "nuevo",
                label: "Nuevo",
                className: "text-sky-300 bg-sky-500/10 border-sky-500/30",
              });
            }
            if (contact?.classification) {
              const classificationMeta = CLASSIFICATION_META[contact.classification];
              if (classificationMeta) {
                extraBadges.push({
                  key: "classification",
                  label: classificationMeta.label,
                  className: classificationMeta.className,
                });
              }
            }

            return (
              <li key={conv.id}>
                <button
                  type="button"
                  onClick={() => onSelect(conv.id)}
                  aria-current={isSelected || undefined}
                  className={cn(
                    "relative flex w-full items-start gap-3 border-b border-zinc-900 px-4 py-3 text-left transition-colors",
                    isSelected ? "bg-zinc-800/60" : "hover:bg-zinc-900/60"
                  )}
                >
                  {isSelected && (
                    <span
                      aria-hidden
                      className="absolute inset-y-0 left-0 w-0.5 bg-cyan-400"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {hasInboundLast && (
                        <span
                          aria-label="Último mensaje del cliente"
                          className="h-2 w-2 flex-shrink-0 rounded-full bg-cyan-400"
                        />
                      )}
                      <span className="truncate font-medium text-zinc-100">
                        {contact?.name ?? conv.id}
                      </span>
                      <span className="ml-auto flex-shrink-0 text-xs text-zinc-500">
                        {formatRelative(conv.lastMessageAt)}
                      </span>
                    </div>
                    {contact?.name && (
                      <p className="truncate text-xs text-zinc-500">{conv.id}</p>
                    )}
                    <p className="mt-0.5 truncate text-sm text-zinc-400">
                      {conv.lastMessagePreview ?? ""}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      <span
                        className={cn(
                          "inline-flex flex-shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                          mode.className
                        )}
                      >
                        <ModeIcon className="h-3 w-3" />
                        {mode.label}
                      </span>
                      {extraBadges.slice(0, 3).map((badge) => (
                        <span
                          key={badge.key}
                          className={cn(
                            "inline-flex flex-shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
                            badge.className
                          )}
                        >
                          {badge.label}
                        </span>
                      ))}
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
