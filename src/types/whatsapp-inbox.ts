import type { Timestamp } from 'firebase/firestore';

/** Modo de una conversación en PixelBot. SQLite del bot = source of truth. */
export type WhatsAppMode = 'BOT' | 'HUMAN' | 'PAUSED';

/**
 * Doc de /tenants/{tenantId}/conversations/{phone}.
 * Escrito por pixelbot (agent/firestore_writers.py — update_conversation).
 * `id` = teléfono E164 (doc id). `lastMessageAt` usa el formato canónico
 * del bot 'YYYY-MM-DD HH:MM:SS' (UTC) — parsear con parseCanonical().
 */
export interface InboxConversation {
  id: string;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  lastMessageDirection?: 'inbound' | 'outbound';
  mode?: WhatsAppMode; // ausente en docs previos al takeover → tratar como 'BOT'
  updatedAt?: string;
  pausedUntil?: string | null;
  suggestedClassification?: ContactClassification;
}

/**
 * Doc de /tenants/{tenantId}/conversations/{phone}/messages/{msgId}.
 * Escrito por pixelbot (agent/firestore_writers.py — write_message).
 */
export interface InboxMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  /** "bot" | uid Firebase del asesor | teléfono del cliente */
  from?: string | null;
  type: string;
  text?: string | null;
  mediaUrl?: string | null;
  caption?: string | null;
  metaTimestamp?: string;
  deliveryStatus?: string | null;
  systemEvent?: string | null;
  createdAt?: string;
}

/** Respuestas del bot vía los proxies /api/whatsapp-inbox/*. */
export interface SendResult {
  status: 'sent' | 'persisted_but_send_failed';
  phone: string;
}

export interface ModeResult {
  status: 'ok';
  phone: string;
  previous_mode: WhatsAppMode;
  mode: WhatsAppMode;
}

export type ConversationStatus = 'nuevo' | 'en_atencion' | 'esperando_cliente' | 'resuelto' | 'archivado';
export type ContactClassification = 'cliente' | 'prospecto' | 'soporte' | 'proveedor' | 'spam' | 'otro';
export type BotTone = 'formal' | 'cercano' | 'tecnico' | 'comercial';

export interface ContactAction { at: string; byUid: string; action: string; }

export interface WhatsAppContact {
  id: string; // phone E164 (doc id)
  name?: string;
  classification?: ContactClassification | null;
  tags?: string[];
  assignedTo?: string | null;
  origin?: string;
  status?: ConversationStatus;
  urgent?: boolean;
  linkedClientId?: string | null;
  actionHistory?: ContactAction[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ContactNote { id: string; text: string; createdBy: string; createdAt?: Timestamp; }

export interface BotSchedule { days: number[]; start: string; end: string; }
export interface BotConfig {
  bot_name: string; tone: BotTone; response_delay_seconds: number;
  schedule: BotSchedule; out_of_hours_message: string; initial_message: string;
  escalation_message: string; can_answer: string[]; cannot_answer: string[];
  escalation_rules: string[]; quote_questions: string[];
  updated_at?: string; updated_by?: string;
}

export const STATUS_META: Record<ConversationStatus, { label: string; className: string }> = {
  nuevo:             { label: 'Nuevo',             className: 'text-sky-300 bg-sky-500/10 border-sky-500/30' },
  en_atencion:       { label: 'En atención',       className: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/30' },
  esperando_cliente: { label: 'Esperando cliente', className: 'text-amber-300 bg-amber-500/10 border-amber-500/30' },
  resuelto:          { label: 'Resuelto',          className: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' },
  archivado:         { label: 'Archivado',         className: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/30' },
};
export const CLASSIFICATION_META: Record<ContactClassification, { label: string; className: string }> = {
  cliente:   { label: 'Cliente',   className: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' },
  prospecto: { label: 'Prospecto', className: 'text-violet-300 bg-violet-500/10 border-violet-500/30' },
  soporte:   { label: 'Soporte',   className: 'text-orange-300 bg-orange-500/10 border-orange-500/30' },
  proveedor: { label: 'Proveedor', className: 'text-blue-300 bg-blue-500/10 border-blue-500/30' },
  spam:      { label: 'Spam',      className: 'text-red-300 bg-red-500/10 border-red-500/30' },
  otro:      { label: 'Otro',      className: 'text-zinc-300 bg-zinc-500/10 border-zinc-500/30' },
};
