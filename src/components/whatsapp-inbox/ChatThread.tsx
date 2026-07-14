"use client";

import { useEffect, useMemo, useRef } from "react";
import { ArrowLeft, PanelRight } from "lucide-react";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { useUser } from "@/hooks/use-user";
import { useInboxContactNotes } from "@/hooks/use-inbox-contact-notes";
import { useInboxMessages } from "@/hooks/use-inbox-messages";
import { cn } from "@/lib/utils";
import { upsertContact } from "@/lib/whatsapp-inbox/contacts-client";
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
  const d = note.createdAt ? new Date(note.createdAt) : new Date();
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
  refetchContacts: () => void;
}

export function ChatThread({
  phone,
  conv,
  onBack,
  contact,
  onOpenPanel,
  refetchConversations,
  refetchContacts,
}: ChatThreadProps) {
  const user = useUser();
  const bottomRef = useRef<HTMLDivElement>(null);

  const { messages, loading, refetch: refetchMessages } = useInboxMessages(phone);
  const { notes, refetch: refetchNotes } = useInboxContactNotes(phone);

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
      time: n.createdAt ? new Date(n.createdAt) : new Date(),
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

  // La pausa puede haber expirado ya en pixelbot (auto-reanuda a BOT) pero el
  // polling todavía no trajo el nuevo `mode` — evita mostrar "en pausa" con un
  // "hasta HH:MM" que ya pasó.
  const pausedExpired = useMemo(() => {
    if (!conv?.pausedUntil) return false;
    return parseCanonical(conv.pausedUntil).getTime() < Date.now();
  }, [conv?.pausedUntil]);

  const suggestedClassification = conv?.suggestedClassification;
  const showSuggestionChip = Boolean(
    suggestedClassification && contact?.classification !== suggestedClassification
  );

  async function handleStatusChange(next: ConversationStatus) {
    if (!user?.uid) {
      toast.error("No se pudo identificar tu usuario.");
      return;
    }
    try {
      await upsertContact(phone, { status: next }, `Estado → ${STATUS_META[next].label}`);
      toast.success(`Estado actualizado a "${STATUS_META[next].label}"`);
      refetchContacts();
    } catch (err) {
      toast.error(`No se pudo actualizar el estado: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function handleConfirmSuggestion() {
    if (!suggestedClassification) return;
    if (!user?.uid) {
      toast.error("No se pudo identificar tu usuario.");
      return;
    }
    const label = CLASSIFICATION_META[suggestedClassification].label;
    try {
      await upsertContact(
        phone,
        { classification: suggestedClassification },
        `Clasificación confirmada: ${label}`
      );
      toast.success(`Clasificación confirmada: ${label}`);
      refetchContacts();
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
          <div className="h-px flex-1 bg-border" />
          <span className="rounded-full border border-border bg-card px-2.5 py-0.5 text-[11px] text-muted-foreground">
            {dateSeparatorLabel(item.time)}
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>
      );
      prevDateKey = dateKey;
    }

    if (item.kind === "note") {
      const note = item.data;
      nodes.push(
        <div key={`note-${note.id}`} className="flex justify-center">
          <div className="w-full max-w-[85%] rounded-lg border border-violet-500/25 bg-violet-500/5 px-3 py-2 text-sm text-violet-700 dark:text-violet-200">
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
                ? "rounded-br-sm bg-emerald-600 text-white"
                : "rounded-br-sm bg-cyan-600 text-white"
              : "rounded-bl-sm bg-secondary text-foreground"
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
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md p-1 text-muted-foreground hover:text-foreground md:hidden"
          aria-label="Volver a la lista"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold text-foreground">{contact?.name || phone}</h2>
          <p className="text-xs text-muted-foreground">
            {windowOpen ? "Ventana de 24h abierta" : "Ventana de 24h cerrada"}
          </p>
        </div>
        <Select value={statusValue} onValueChange={(v) => handleStatusChange(v as ConversationStatus)}>
          <SelectTrigger className="h-8 w-40 border-border bg-secondary/40 text-xs text-foreground focus:ring-cyan-500/20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-border bg-popover/95 backdrop-blur-xl">
            {Object.entries(STATUS_META).map(([value, meta]) => (
              <SelectItem
                key={value}
                value={value}
                className="text-sm text-popover-foreground focus:bg-secondary focus:text-foreground"
              >
                {meta.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          type="button"
          onClick={onOpenPanel}
          className="rounded-md border border-border p-1.5 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Abrir panel de contacto"
        >
          <PanelRight className="h-4 w-4" />
        </button>
        <ModeToggle phone={phone} mode={mode} onChanged={refetchConversations} />
      </div>

      {/* Banners de estado del bot + sugerencia */}
      {mode === "PAUSED" && (
        <div className="border-b border-border bg-amber-500/5 px-4 py-2 text-xs text-amber-700 dark:text-amber-300">
          {pausedExpired
            ? "⏸ Pausa expirada — el bot ya debería reanudarse, actualizando…"
            : <>⏸ Bot en pausa{pausedUntilLabel ? ` hasta las ${pausedUntilLabel}` : " hasta que lo reactives"} — nadie
              responde automáticamente</>}
        </div>
      )}
      {mode === "HUMAN" && (
        <div className="border-b border-border bg-emerald-500/5 px-4 py-2 text-xs text-emerald-700 dark:text-emerald-300">
          🖐 Control humano activo — el bot no responde en esta conversación
        </div>
      )}
      {showSuggestionChip && suggestedClassification && (
        <div className="flex items-center justify-between gap-3 border-b border-border bg-violet-500/5 px-4 py-2 text-xs text-violet-700 dark:text-violet-300">
          <span>
            El bot sugiere: <strong>{CLASSIFICATION_META[suggestedClassification].label}</strong>
          </span>
          <button
            type="button"
            onClick={() => void handleConfirmSuggestion()}
            className="flex-shrink-0 rounded-md border border-violet-500/40 bg-violet-500/10 px-2.5 py-1 text-[11px] font-medium text-violet-700 dark:text-violet-200 transition-colors hover:bg-violet-500/20"
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
              <Spinner size="md" className="text-muted-foreground" />
            </div>
          )}
          {nodes}
          <div ref={bottomRef} />
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-5 bg-gradient-to-b from-background/80 to-transparent"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-background/80 to-transparent"
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
        onNoteSaved={refetchNotes}
      />
    </div>
  );
}
