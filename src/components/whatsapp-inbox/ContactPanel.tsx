"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Plus, Ticket, X } from "lucide-react";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { useUser } from "@/hooks/use-user";
import { useCRM } from "@/components/crm/CRMContextCore";
import { useInboxContactNotes } from "@/hooks/use-inbox-contact-notes";
import { useInboxBotMemory } from "@/hooks/use-inbox-bot-memory";
import type { ContactPatch } from "@/lib/db/repos/whatsapp-contacts";
import { cn } from "@/lib/utils";
import { addContactNote, createWhatsappTicket, upsertContact } from "@/lib/whatsapp-inbox/contacts-client";
import { parseCanonical } from "@/lib/whatsapp-inbox/time";
import {
  CLASSIFICATION_META,
  MEMORY_KEY_LABELS,
  STATUS_META,
  type ConversationStatus,
  type ContactClassification,
  type InboxConversation,
  type WhatsAppContact,
} from "@/types/whatsapp-inbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ModeToggle } from "./ModeToggle";

const MODE_META: Record<string, { label: string; className: string }> = {
  BOT: { label: "Bot", className: "text-cyan-700 dark:text-cyan-300 bg-cyan-500/10 border-cyan-500/30" },
  HUMAN: { label: "Tú", className: "text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/30" },
  PAUSED: { label: "Pausa", className: "text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/30" },
};

const NO_CLASSIFICATION = "none";
const MAX_TAGS = 10;

function formatRelative(canonical?: string): string {
  if (!canonical) return "sin datos";
  const date = parseCanonical(canonical);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "hace instantes";
  if (mins < 60) return `hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  return `el ${date.toLocaleDateString("es-MX", { day: "numeric", month: "short" })}`;
}

function formatHistoryDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-MX", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 rounded-xl border border-border p-3">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

interface ContactPanelProps {
  tenantId: string;
  phone: string;
  conv?: InboxConversation;
  contact?: WhatsAppContact;
  onClose: () => void;
  onModeChanged: () => void;
  refetchContacts: () => void;
}

export function ContactPanel({ phone, conv, contact, onClose, onModeChanged, refetchContacts }: ContactPanelProps) {
  const user = useUser();
  const crm = useCRM();

  const [name, setName] = useState(contact?.name ?? "");
  const [origin, setOrigin] = useState(contact?.origin ?? "");
  const [tagInput, setTagInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [ticketProblem, setTicketProblem] = useState("");
  const [ticketOpen, setTicketOpen] = useState(false);
  const [followUpProjectId, setFollowUpProjectId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  useEffect(() => setName(contact?.name ?? ""), [contact?.name]);
  useEffect(() => setOrigin(contact?.origin ?? ""), [contact?.origin]);

  const { notes, refetch: refetchNotes } = useInboxContactNotes(phone);
  const { memory } = useInboxBotMemory(phone);

  const mode = conv?.mode ?? "BOT";
  const pausedUntilLabel = useMemo(() => {
    if (!conv?.pausedUntil) return null;
    return parseCanonical(conv.pausedUntil).toLocaleTimeString("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [conv?.pausedUntil]);

  // Igual que en ChatThread: la pausa puede haber expirado ya en pixelbot
  // (auto-reanuda a BOT) antes de que el polling traiga el nuevo `mode`.
  const pausedExpired = useMemo(() => {
    if (!conv?.pausedUntil) return false;
    return parseCanonical(conv.pausedUntil).getTime() < Date.now();
  }, [conv?.pausedUntil]);

  // `byUid` (actionHistory) ya no lo maneja el cliente — el servidor lo deriva
  // de la sesión (requireAdmin). Este helper solo obtiene el uid cuando el
  // dato en sí lo necesita (ej. assignedTo: "asignarme a mí").
  function requireUid(): string | null {
    if (!user?.uid) {
      toast.error("No se pudo identificar tu usuario.");
      return null;
    }
    return user.uid;
  }

  async function saveField(data: ContactPatch, action: string, successMsg?: string) {
    try {
      await upsertContact(phone, data, action);
      if (successMsg) toast.success(successMsg);
      refetchContacts();
    } catch (err) {
      toast.error(`No se pudo guardar: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function handleNameBlur() {
    const trimmed = name.trim();
    if (trimmed === (contact?.name ?? "")) return;
    void saveField({ name: trimmed || undefined }, "Nombre actualizado");
  }

  function handleOriginBlur() {
    const trimmed = origin.trim();
    if (trimmed === (contact?.origin ?? "")) return;
    void saveField({ origin: trimmed || undefined }, "Origen actualizado");
  }

  async function handleCopyPhone() {
    try {
      await navigator.clipboard.writeText(phone);
      toast.success("Teléfono copiado");
    } catch {
      toast.error("No se pudo copiar el teléfono");
    }
  }

  function handleClassificationChange(value: string) {
    const next = value === NO_CLASSIFICATION ? null : (value as ContactClassification);
    const label = next ? CLASSIFICATION_META[next].label : "Sin clasificar";
    void saveField({ classification: next }, `Clasificación → ${label}`);
  }

  function handleUseSuggestion() {
    if (!conv?.suggestedClassification) return;
    const label = CLASSIFICATION_META[conv.suggestedClassification].label;
    void saveField({ classification: conv.suggestedClassification }, `Clasificación confirmada: ${label}`, `Clasificación confirmada: ${label}`);
  }

  function handleUrgentToggle(checked: boolean) {
    void saveField({ urgent: checked }, checked ? "Marcado urgente" : "Urgente desmarcado");
  }

  function handleStatusChange(value: string) {
    const next = value as ConversationStatus;
    void saveField({ status: next }, `Estado → ${STATUS_META[next].label}`, `Estado actualizado a "${STATUS_META[next].label}"`);
  }

  function handleAssignToggle() {
    const uid = requireUid();
    if (!uid) return;
    const isMine = contact?.assignedTo === uid;
    void saveField(
      { assignedTo: isMine ? null : uid },
      isMine ? "Responsable removido" : "Asignado a mí"
    );
  }

  function handleAddTag() {
    const raw = tagInput.trim().toLowerCase();
    if (!raw) return;
    const existing = contact?.tags ?? [];
    if (existing.includes(raw)) {
      setTagInput("");
      return;
    }
    if (existing.length >= MAX_TAGS) {
      toast.error(`Máximo ${MAX_TAGS} etiquetas`);
      return;
    }
    void saveField({ tags: [...existing, raw] }, `Etiqueta añadida: ${raw}`);
    setTagInput("");
  }

  function handleRemoveTag(tag: string) {
    const existing = contact?.tags ?? [];
    void saveField({ tags: existing.filter((t) => t !== tag) }, `Etiqueta removida: ${tag}`);
  }

  async function handleSaveContact() {
    if (pendingAction) return;
    setPendingAction("saveContact");
    try {
      // createdAt ya no se pasa: el repo lo fija automáticamente la primera
      // vez que la fila se crea (ver src/lib/db/repos/whatsapp-contacts.ts).
      await upsertContact(phone, { name: name.trim() || undefined, status: "nuevo" }, "Contacto guardado");
      toast.success("Contacto guardado");
      refetchContacts();
    } catch (err) {
      toast.error(`No se pudo guardar el contacto: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPendingAction(null);
    }
  }

  async function handleConvertToClient() {
    if (pendingAction) return;
    setPendingAction("convertToClient");
    try {
      const id = crm.addClient({
        name: contact?.name || phone,
        phone,
        contactName: contact?.name,
        email: "",
        location: "",
        notes: "Origen: WhatsApp Inbox",
      });
      if (!id) return; // addClient ya mostró el toast de error
      await upsertContact(phone, { linkedClientId: id, classification: "cliente" }, "Convertido en cliente CRM");
      toast.success("Cliente creado y vinculado");
      refetchContacts();
    } catch (err) {
      toast.error(`No se pudo vincular el cliente: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPendingAction(null);
    }
  }

  const linkedClient = contact?.linkedClientId
    ? crm.clients.find((c) => c.id === contact.linkedClientId)
    : undefined;
  const followUpEligible = Boolean(linkedClient && linkedClient.projects.length >= 1);
  const followUpProject = linkedClient?.projects.length === 1
    ? linkedClient.projects[0]
    : linkedClient?.projects.find((p) => p.id === followUpProjectId);

  async function handleCreateFollowUp() {
    if (pendingAction) return;
    if (!linkedClient || !followUpProject) return;
    setPendingAction("createFollowUp");
    try {
      crm.addTask(linkedClient.id, followUpProject.id, {
        name: `Seguimiento WhatsApp — ${contact?.name || phone}`,
        desc: `Conversación: ${phone}`,
        prio: "important",
      });
      await saveField({}, "Seguimiento creado en CRM", "Seguimiento creado");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleCreateTicket() {
    if (pendingAction) return;
    const problema = ticketProblem.trim();
    if (!problema) {
      toast.error("Describe el problema antes de crear el ticket");
      return;
    }
    setPendingAction("createTicket");
    try {
      const { ticketId } = await createWhatsappTicket(phone, problema, contact?.name);
      await upsertContact(phone, {}, `Ticket creado: ${ticketId}`);
      toast.success(`Ticket creado: ${ticketId}`);
      setTicketProblem("");
      setTicketOpen(false);
      refetchContacts();
    } catch (err) {
      toast.error(`No se pudo crear el ticket: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPendingAction(null);
    }
  }

  async function handleAddNote() {
    const text = noteInput.trim();
    if (!text) return;
    try {
      await addContactNote(phone, text);
      setNoteInput("");
      refetchNotes();
    } catch (err) {
      toast.error(`No se pudo añadir la nota: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const recentNotes = (notes ?? []).slice(-5).reverse();
  const recentHistory = (contact?.actionHistory ?? []).slice(-5).reverse();
  const classificationValue = contact?.classification ?? NO_CLASSIFICATION;
  const statusValue = contact?.status ?? "nuevo";
  const showSuggestion = Boolean(
    conv?.suggestedClassification && contact?.classification !== conv.suggestedClassification
  );
  const isAssignedToMe = user?.uid && contact?.assignedTo === user.uid;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-border px-3 py-3">
        <h3 className="text-sm font-semibold text-foreground">Ficha del contacto</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Cerrar panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="scrollbar-soft min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {/* Identidad */}
        <SectionCard title="Identidad">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            placeholder="Nombre del contacto"
            className="h-8 border-border bg-secondary/40 text-sm text-foreground"
          />
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="truncate font-mono">{phone}</span>
            <button
              type="button"
              onClick={handleCopyPhone}
              className="flex-shrink-0 rounded-md border border-border p-1 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Copiar teléfono"
            >
              <Copy className="h-3 w-3" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Última interacción: {formatRelative(conv?.lastMessageAt)}
          </p>
        </SectionCard>

        {/* Clasificación */}
        <SectionCard title="Clasificación">
          <Select value={classificationValue} onValueChange={handleClassificationChange}>
            <SelectTrigger className="h-8 border-border bg-secondary/40 text-xs text-foreground focus:ring-cyan-500/20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-border bg-popover/95 backdrop-blur-xl">
              <SelectItem value={NO_CLASSIFICATION} className="text-sm text-popover-foreground focus:bg-secondary focus:text-foreground">
                Sin clasificar
              </SelectItem>
              {Object.entries(CLASSIFICATION_META).map(([value, meta]) => (
                <SelectItem key={value} value={value} className="text-sm text-popover-foreground focus:bg-secondary focus:text-foreground">
                  {meta.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {showSuggestion && conv?.suggestedClassification && (
            <button
              type="button"
              onClick={handleUseSuggestion}
              className="w-full rounded-md border border-violet-500/30 bg-violet-500/5 px-2 py-1.5 text-left text-[11px] text-violet-700 dark:text-violet-300 transition-colors hover:bg-violet-500/10"
            >
              El bot sugiere: <strong>{CLASSIFICATION_META[conv.suggestedClassification].label}</strong> · usar
            </button>
          )}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Urgente</span>
            <Switch checked={Boolean(contact?.urgent)} onCheckedChange={handleUrgentToggle} />
          </div>
        </SectionCard>

        {/* Atención */}
        <SectionCard title="Atención">
          <Select value={statusValue} onValueChange={handleStatusChange}>
            <SelectTrigger className="h-8 border-border bg-secondary/40 text-xs text-foreground focus:ring-cyan-500/20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-border bg-popover/95 backdrop-blur-xl">
              {Object.entries(STATUS_META).map(([value, meta]) => (
                <SelectItem key={value} value={value} className="text-sm text-popover-foreground focus:bg-secondary focus:text-foreground">
                  {meta.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAssignToggle}
            className="h-8 w-full border-border bg-secondary/40 text-xs text-muted-foreground hover:bg-secondary/60"
          >
            {isAssignedToMe ? "Quitarme como responsable" : "Asignarme"}
          </Button>
          <Input
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            onBlur={handleOriginBlur}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            placeholder="Origen (ej. Anuncio IG)"
            className="h-8 border-border bg-secondary/40 text-sm text-foreground"
          />
        </SectionCard>

        {/* Etiquetas */}
        <SectionCard title="Etiquetas">
          <div className="flex flex-wrap gap-1.5">
            {(contact?.tags ?? []).map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="gap-1 border-border bg-secondary text-[11px] font-normal text-secondary-foreground"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  aria-label={`Quitar etiqueta ${tag}`}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            ))}
            {!(contact?.tags ?? []).length && <span className="text-xs text-muted-foreground/60">Sin etiquetas</span>}
          </div>
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
            placeholder="Nueva etiqueta ⏎"
            className="h-8 border-border bg-secondary/40 text-sm text-foreground"
          />
        </SectionCard>

        {/* Bot */}
        <SectionCard title="Bot">
          <div className="flex items-center justify-between">
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                MODE_META[mode]?.className
              )}
            >
              {MODE_META[mode]?.label ?? mode}
            </span>
            {mode === "PAUSED" && pausedExpired && (
              <span className="text-[11px] text-amber-700 dark:text-amber-300">pausa expirada</span>
            )}
            {mode === "PAUSED" && !pausedExpired && pausedUntilLabel && (
              <span className="text-[11px] text-amber-700 dark:text-amber-300">hasta {pausedUntilLabel}</span>
            )}
          </div>
          <ModeToggle phone={phone} mode={mode} onChanged={onModeChanged} />
        </SectionCard>

        {/* Acciones */}
        <SectionCard title="Acciones">
          <div className="space-y-1.5">
            {!contact && (
              <Button
                type="button"
                onClick={handleSaveContact}
                disabled={pendingAction !== null}
                className="h-8 w-full bg-cyan-600 text-xs text-white hover:bg-cyan-500"
              >
                {pendingAction === "saveContact" && <Spinner size="sm" />}
                Guardar contacto
              </Button>
            )}

            {contact?.linkedClientId ? (
              <p className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-2 py-1.5 text-[11px] text-emerald-700 dark:text-emerald-300">
                Vinculado al CRM ✓
              </p>
            ) : (
              <Button
                type="button"
                onClick={handleConvertToClient}
                disabled={pendingAction !== null}
                variant="outline"
                size="sm"
                className="h-8 w-full border-border bg-secondary/40 text-xs text-muted-foreground hover:bg-secondary/60"
              >
                {pendingAction === "convertToClient" && <Spinner size="sm" />}
                Convertir en cliente
              </Button>
            )}

            {followUpEligible ? (
              <div className="space-y-1.5">
                {linkedClient!.projects.length > 1 && (
                  <Select value={followUpProjectId ?? undefined} onValueChange={setFollowUpProjectId}>
                    <SelectTrigger className="h-8 border-border bg-secondary/40 text-xs text-foreground focus:ring-cyan-500/20">
                      <SelectValue placeholder="Selecciona proyecto" />
                    </SelectTrigger>
                    <SelectContent className="border-border bg-popover/95 backdrop-blur-xl">
                      {linkedClient!.projects.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="text-sm text-popover-foreground focus:bg-secondary focus:text-foreground">
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button
                  type="button"
                  onClick={handleCreateFollowUp}
                  disabled={!followUpProject || pendingAction !== null}
                  variant="outline"
                  size="sm"
                  className="h-8 w-full border-border bg-secondary/40 text-xs text-muted-foreground hover:bg-secondary/60 disabled:opacity-40"
                >
                  {pendingAction === "createFollowUp" && <Spinner size="sm" />}
                  Crear seguimiento
                </Button>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground/60">
                Vincula un cliente con proyecto para crear seguimientos
              </p>
            )}

            <Popover open={ticketOpen} onOpenChange={setTicketOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-full border-border bg-secondary/40 text-xs text-muted-foreground hover:bg-secondary/60"
                >
                  <Ticket className="h-3.5 w-3.5" />
                  Crear ticket de soporte
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 border-border bg-popover/95 p-3 backdrop-blur-xl">
                <p className="mb-2 text-xs font-medium text-popover-foreground">¿Cuál es el problema?</p>
                <Textarea
                  value={ticketProblem}
                  onChange={(e) => setTicketProblem(e.target.value)}
                  placeholder="Describe el problema..."
                  className="mb-2 min-h-[70px] border-border bg-secondary/40 text-sm text-foreground"
                />
                <Button
                  type="button"
                  onClick={handleCreateTicket}
                  disabled={pendingAction !== null}
                  className="h-8 w-full bg-cyan-600 text-xs text-white hover:bg-cyan-500"
                >
                  {pendingAction === "createTicket" && <Spinner size="sm" />}
                  Crear ticket
                </Button>
              </PopoverContent>
            </Popover>

            <Button
              type="button"
              onClick={() => void saveField({ status: "resuelto" }, "Marcado como resuelto", "Marcado como resuelto")}
              variant="ghost"
              size="sm"
              className="h-8 w-full text-xs text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            >
              <Check className="h-3.5 w-3.5" />
              Marcar como resuelto
            </Button>
            <Button
              type="button"
              onClick={() => void saveField({ status: "archivado" }, "Archivado", "Conversación archivada")}
              variant="ghost"
              size="sm"
              className="h-8 w-full text-xs text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            >
              Archivar
            </Button>
          </div>
        </SectionCard>

        {/* Memoria del bot */}
        <SectionCard title="Memoria del bot">
          <div className="space-y-1.5">
            {memory.length === 0 && (
              <p className="text-xs text-muted-foreground/60">
                El bot aún no recuerda datos de este contacto.
              </p>
            )}
            {memory.map((entry) => {
              const expired = Boolean(entry.expires_at) && new Date(entry.expires_at!).getTime() < Date.now();
              return (
                <div
                  key={entry.key}
                  className={cn(
                    "flex items-start justify-between gap-2 rounded-md border px-2 py-1.5",
                    expired ? "border-border/50 opacity-50" : "border-border bg-secondary/20"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-muted-foreground">{MEMORY_KEY_LABELS[entry.key]}</p>
                    <p className="truncate text-xs text-foreground">{entry.value}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "flex-shrink-0 font-normal",
                      entry.source === "customer"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                    )}
                  >
                    {entry.source === "customer" ? "del cliente" : "inferido"}
                  </Badge>
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* Notas */}
        <SectionCard title="Notas">
          <div className="space-y-1.5">
            {recentNotes.length === 0 && <p className="text-xs text-muted-foreground/60">Sin notas aún</p>}
            {recentNotes.map((note) => (
              <p key={note.id} className="rounded-md border border-violet-500/20 bg-violet-500/5 px-2 py-1.5 text-xs text-violet-700 dark:text-violet-200">
                {note.text}
              </p>
            ))}
          </div>
          <div className="flex gap-1.5">
            <Input
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void handleAddNote()}
              placeholder="Nota rápida..."
              className="h-8 border-border bg-secondary/40 text-sm text-foreground"
            />
            <Button
              type="button"
              onClick={() => void handleAddNote()}
              variant="outline"
              size="icon"
              className="h-8 w-8 flex-shrink-0 border-border bg-secondary/40 text-secondary-foreground hover:bg-secondary/60"
              aria-label="Añadir nota"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </SectionCard>

        {/* Historial */}
        <SectionCard title="Historial">
          <div className="space-y-1">
            {recentHistory.length === 0 && <p className="text-xs text-muted-foreground/60">Sin actividad registrada</p>}
            {recentHistory.map((entry, idx) => (
              <p key={`${entry.at}-${idx}`} className="text-xs text-muted-foreground">
                {entry.action} · {formatHistoryDate(entry.at)}
              </p>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
