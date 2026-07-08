"use client";

import { useEffect, useMemo, useRef } from "react";
import { ArrowLeft, LoaderCircle, PanelRight } from "lucide-react";
import { toast } from "sonner";
import { useCollection, useFirestore, useUser } from "@/firebase";
import { useInboxMessages } from "@/hooks/use-inbox-messages";
import { cn } from "@/lib/utils";
import { notesQuery, upsertContact } from "@/lib/whatsapp-inbox/contacts";
import { parseCanonical } from "@/lib/whatsapp-inbox/time";
import {
  CLASSIFICATION_META,
  STATUS_META,
  type ConversationStatus,
  type ContactNote,
  type InboxConversation,
  type InboxMessage,
  type WhatsAppContact,
} from "@/types/whatsapp-inbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Composer } from "./Composer";
import { ModeToggle } from "./ModeToggle";

const WINDOW_MS = 24 * 60 * 60 * 1000;

function formatTime(msg: InboxMessage): string {
  const ts = msg.metaTimestamp ?? msg.createdAt;
  if (!ts) return "";
  return parseCanonical(ts).toLocaleString("es-MX", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatNoteTime(note: ContactNote): string {
  const d = note.createdAt ? note.createdAt.toDate() : new Date();
  return d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

/** "Hoy" / "Ayer" / "2 jul 2026" comparando contra el día local actual. */
function dateSeparatorLabel(d: Date): string {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (d.toDateString() === now.toDateString()) return "Hoy";
  if (d.toDateString() === yesterday.toDateString()) return "Ayer";
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

type TimelineItem =
  | { kind: "message"; id: string; time: Date; data: InboxMessage }
  | { kind: "note"; id: string; time: Date; data: ContactNote };

interface ChatThreadProps {
  tenantId: string;
  phone: string;
  conv?: InboxConversation;
  onBack: () => void;
  contact?: WhatsAppContact;
  onOpenPanel: () => void;
  refetchConversations: () => void;
}

export function ChatThread({
  phone,
  conv,
  onBack,
  contact,
  onOpenPanel,
  refetchConversations,
}: ChatThreadProps) {
  const firestore = useFirestore();
  const user = useUser();
  const bottomRef = useRef<HTMLDivElement>(null);

  const notesRef = useMemo(() => {
    if (!firestore) return null;
    return notesQuery(firestore, phone);
  }, [firestore, phone]);

  const { messages, loading, refetch: refetchMessages } = useInboxMessages(phone);
  const { data: notes } = useCollection<ContactNote>(notesRef, { listen: true });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length, notes?.length]);

  const mode = conv?.mode ?? "BOT";

  // Ventana de 24h de Meta: cuenta desde el último mensaje DEL CLIENTE (inbound).
  const windowOpen = useMemo(() => {
    const lastInbound = [...(messages ?? [])]
      .reverse()
      .find((m) => m.direction === "inbound");
    const ts = lastInbound?.metaTimestamp ?? lastInbound?.createdAt;
    if (!ts) return false;
    return Date.now() - parseCanonical(ts).getTime() < WINDOW_MS;
  }, [messages]);

  // Timeline mergeada: mensajes + notas internas ordenados por hora.
  // Fallback a `new Date()` si createdAt aún no resolvió (serverTimestamp pendiente),
  // así el item más reciente cae al final en vez de al principio.
  const timeline = useMemo<TimelineItem[]>(() => {
    const msgItems: TimelineItem[] = (messages ?? []).map((m) => {
      const ts = m.createdAt ?? m.metaTimestamp;
      return {
        kind: "message" as const,
        id: m.id,
        time: ts ? parseCanonical(ts) : new Date(),
        data: m,
      };
    });
    const noteItems: TimelineItem[] = (notes ?? []).map((n) => ({
      kind: "note",
      id: n.id,
      time: n.createdAt ? n.createdAt.toDate() : new Date(),
      data: n,
    }));
    return [...msgItems, ...noteItems].sort((a, b) => a.time.getTime() - b.time.getTime());
  }, [messages, notes]);

  const pausedUntilLabel = useMemo(() => {
    if (!conv?.pausedUntil) return null;
    return parseCanonical(conv.pausedUntil).toLocaleTimeString("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [conv?.pausedUntil]);

  const suggestedClassification = conv?.suggestedClassification;
  const showSuggestionChip = Boolean(
    suggestedClassification && contact?.classification !== suggestedClassification
  );

  async function handleStatusChange(next: ConversationStatus) {
    if (!firestore) return;
    if (!user?.uid) {
      toast.error("No se pudo identificar tu usuario.");
      return;
    }
    try {
      await upsertContact(firestore, phone, { status: next }, user.uid, `Estado → ${STATUS_META[next].label}`);
      toast.success(`Estado actualizado a "${STATUS_META[next].label}"`);
    } catch (err) {
      toast.error(`No se pudo actualizar el estado: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function handleConfirmSuggestion() {
    if (!firestore || !suggestedClassification) return;
    if (!user?.uid) {
      toast.error("No se pudo identificar tu usuario.");
      return;
    }
    const label = CLASSIFICATION_META[suggestedClassification].label;
    try {
      await upsertContact(
        firestore,
        phone,
        { classification: suggestedClassification },
        user.uid,
        `Clasificación confirmada: ${label}`
      );
      toast.success(`Clasificación confirmada: ${label}`);
    } catch (err) {
      toast.error(`No se pudo confirmar la clasificación: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const statusValue = contact?.status ?? "nuevo";

  const nodes: React.ReactNode[] = [];
  let prevDateKey: string | null = null;
  for (const item of timeline) {
    const dateKey = item.time.toDateString();
    if (dateKey !== prevDateKey) {
      nodes.push(
        <div key={`sep-${dateKey}`} className="flex items-center gap-3 py-2">
          <div className="h-px flex-1 bg-zinc-800" />
          <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-0.5 text-[11px] text-zinc-500">
            {dateSeparatorLabel(item.time)}
          </span>
          <div className="h-px flex-1 bg-zinc-800" />
        </div>
      );
      prevDateKey = dateKey;
    }

    if (item.kind === "note") {
      const note = item.data;
      nodes.push(
        <div key={`note-${note.id}`} className="flex justify-center">
          <div className="w-full max-w-[85%] rounded-lg border border-violet-500/25 bg-violet-500/5 px-3 py-2 text-sm text-violet-200">
            <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide opacity-70">
              📝 Nota interna · {formatNoteTime(note)}
            </p>
            <p className="whitespace-pre-wrap break-words">{note.text}</p>
          </div>
        </div>
      );
      continue;
    }

    const msg = item.data;
    const isOutbound = msg.direction === "outbound";
    const isManual = isOutbound && msg.from !== "bot";
    nodes.push(
      <div key={`msg-${msg.id}`} className={cn("flex", isOutbound ? "justify-end" : "justify-start")}>
        <div
          className={cn(
            "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm",
            isOutbound
              ? isManual
                ? "rounded-br-sm bg-emerald-600/25 text-emerald-50"
                : "rounded-br-sm bg-cyan-600/25 text-cyan-50"
              : "rounded-bl-sm bg-zinc-800 text-zinc-100"
          )}
        >
          {isOutbound && (
            <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide opacity-60">
              {isManual ? "Tú (manual)" : "Bot"}
            </p>
          )}
          <p className="whitespace-pre-wrap break-words">{msg.text ?? `[${msg.type}]`}</p>
          <p className="mt-1 text-right text-[10px] opacity-50">{formatTime(msg)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header del hilo */}
      <div className="flex flex-wrap items-center gap-3 border-b border-zinc-800/60 px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md p-1 text-zinc-400 hover:text-zinc-100 md:hidden"
          aria-label="Volver a la lista"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold text-zinc-100">{contact?.name || phone}</h2>
          <p className="text-xs text-zinc-500">
            {windowOpen ? "Ventana de 24h abierta" : "Ventana de 24h cerrada"}
          </p>
        </div>
        <Select value={statusValue} onValueChange={(v) => handleStatusChange(v as ConversationStatus)}>
          <SelectTrigger className="h-8 w-40 border-zinc-800 bg-zinc-900/60 text-xs text-zinc-300 focus:ring-cyan-500/20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-zinc-800/60 bg-zinc-900/95 backdrop-blur-xl">
            {Object.entries(STATUS_META).map(([value, meta]) => (
              <SelectItem
                key={value}
                value={value}
                className="text-sm text-zinc-300 focus:bg-white/[0.06] focus:text-zinc-100"
              >
                {meta.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          type="button"
          onClick={onOpenPanel}
          className="rounded-md border border-zinc-800 p-1.5 text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-100"
          aria-label="Abrir panel de contacto"
        >
          <PanelRight className="h-4 w-4" />
        </button>
        <ModeToggle phone={phone} mode={mode} onChanged={refetchConversations} />
      </div>

      {/* Banners de estado del bot + sugerencia */}
      {mode === "PAUSED" && (
        <div className="border-b border-zinc-800/60 bg-amber-500/5 px-4 py-2 text-xs text-amber-300">
          ⏸ Bot en pausa{pausedUntilLabel ? ` hasta las ${pausedUntilLabel}` : " hasta que lo reactives"} — nadie
          responde automáticamente
        </div>
      )}
      {mode === "HUMAN" && (
        <div className="border-b border-zinc-800/60 bg-emerald-500/5 px-4 py-2 text-xs text-emerald-300">
          🖐 Control humano activo — el bot no responde en esta conversación
        </div>
      )}
      {showSuggestionChip && suggestedClassification && (
        <div className="flex items-center justify-between gap-3 border-b border-zinc-800/60 bg-violet-500/5 px-4 py-2 text-xs text-violet-300">
          <span>
            El bot sugiere: <strong>{CLASSIFICATION_META[suggestedClassification].label}</strong>
          </span>
          <button
            type="button"
            onClick={() => void handleConfirmSuggestion()}
            className="flex-shrink-0 rounded-md border border-violet-500/40 bg-violet-500/10 px-2.5 py-1 text-[11px] font-medium text-violet-200 transition-colors hover:bg-violet-500/20"
          >
            Confirmar
          </button>
        </div>
      )}

      {/* Mensajes + notas — scroller interno con fades arriba/abajo */}
      <div className="relative min-h-0 flex-1">
        <div className="scrollbar-soft h-full space-y-2 overflow-y-auto p-4">
          {loading && (
            <div className="flex justify-center py-8">
              <LoaderCircle className="h-5 w-5 animate-spin text-zinc-500" />
            </div>
          )}
          {nodes}
          <div ref={bottomRef} />
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-5 bg-gradient-to-b from-[#030303]/80 to-transparent"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-[#030303]/80 to-transparent"
        />
      </div>

      <Composer
        phone={phone}
        mode={mode}
        windowOpen={windowOpen}
        onSent={() => {
          refetchMessages();
          refetchConversations();
        }}
      />
    </div>
  );
}
