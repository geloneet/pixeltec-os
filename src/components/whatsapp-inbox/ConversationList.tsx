"use client";

import { useMemo, useState } from "react";
import { collection, orderBy, query, type Query } from "firebase/firestore";
import { Bot, Hand, LoaderCircle, PauseCircle, Search } from "lucide-react";
import { useCollection, useFirestore } from "@/firebase";
import { cn } from "@/lib/utils";
import { parseCanonical } from "@/lib/whatsapp-inbox/time";
import {
  CLASSIFICATION_META,
  type ContactClassification,
  type InboxConversation,
  type WhatsAppContact,
  type WhatsAppMode,
} from "@/types/whatsapp-inbox";

const MODE_META: Record<WhatsAppMode, { label: string; icon: typeof Bot; className: string }> = {
  BOT: { label: "Bot", icon: Bot, className: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30" },
  HUMAN: { label: "Tú", icon: Hand, className: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  PAUSED: { label: "Pausa", icon: PauseCircle, className: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
};

type FilterId =
  | "todos"
  | "sin_responder"
  | "bot_activo"
  | "control_humano"
  | "prospectos"
  | "clientes"
  | "soporte"
  | "archivados";

const CLASSIFICATION_FILTERS: { id: FilterId; classification: ContactClassification }[] = [
  { id: "prospectos", classification: "prospecto" },
  { id: "clientes", classification: "cliente" },
  { id: "soporte", classification: "soporte" },
];

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "sin_responder", label: "Sin responder" },
  { id: "bot_activo", label: "Bot activo" },
  { id: "control_humano", label: "Control humano" },
  { id: "prospectos", label: "Prospectos" },
  { id: "clientes", label: "Clientes" },
  { id: "soporte", label: "Soporte" },
  { id: "archivados", label: "Archivados" },
];

function matchesFilter(
  filter: FilterId,
  conv: InboxConversation,
  contact: WhatsAppContact | undefined
): boolean {
  switch (filter) {
    case "todos":
      return contact?.status !== "archivado";
    case "sin_responder":
      return conv.lastMessageDirection === "inbound";
    case "bot_activo":
      return (conv.mode ?? "BOT") === "BOT";
    case "control_humano":
      return conv.mode === "HUMAN";
    case "archivados":
      return contact?.status === "archivado";
    default: {
      const classificationFilter = CLASSIFICATION_FILTERS.find((f) => f.id === filter);
      return classificationFilter ? contact?.classification === classificationFilter.classification : true;
    }
  }
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
  contactsByPhone: Map<string, WhatsAppContact>;
  selectedPhone: string | null;
  onSelect: (phone: string) => void;
}

export function ConversationList({
  tenantId,
  contactsByPhone,
  selectedPhone,
  onSelect,
}: ConversationListProps) {
  const firestore = useFirestore();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterId>("todos");

  // Nota: orderBy('lastMessageAt') excluye docs sin ese campo — solo aparecen
  // conversaciones con al menos un mensaje proyectado, que es lo deseado.
  const ref = useMemo(() => {
    if (!firestore || !tenantId) return null;
    return query(
      collection(firestore, "tenants", tenantId, "conversations"),
      orderBy("lastMessageAt", "desc")
    ) as Query<InboxConversation>;
  }, [firestore, tenantId]);

  const { data: conversations, loading, error } = useCollection<InboxConversation>(ref, {
    listen: true,
  });

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (conversations ?? []).filter((conv) => {
      const contact = contactsByPhone.get(conv.id);
      if (!matchesFilter(activeFilter, conv, contact)) return false;
      if (!q) return true;
      const haystack = [
        conv.id,
        contact?.name ?? "",
        conv.lastMessagePreview ?? "",
        ...(contact?.tags ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [conversations, contactsByPhone, activeFilter, search]);

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <LoaderCircle className="h-5 w-5 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-red-400">
        Error cargando conversaciones: {error.message}
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
      <div className="border-b border-zinc-800/60 px-4 py-3">
        <h1 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          WhatsApp — {filteredConversations.length} conversación
          {filteredConversations.length === 1 ? "" : "es"}
        </h1>

        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, teléfono, mensaje o etiqueta…"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 py-2 pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500/50 focus:outline-none"
          />
        </div>

        <div className="mt-2 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setActiveFilter(filter.id)}
              className={cn(
                "flex-shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs transition-colors",
                activeFilter === filter.id
                  ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-300"
                  : "border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="p-6 text-center text-sm text-zinc-500">
            Nada por aquí con este filtro.
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
                  className={cn(
                    "flex w-full items-start gap-3 border-b border-zinc-900 px-4 py-3 text-left transition-colors",
                    isSelected ? "bg-zinc-800/60" : "hover:bg-zinc-900/60"
                  )}
                >
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
