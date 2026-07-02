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
  updatedAt?: Timestamp;
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
  metaTimestamp?: Timestamp;
  deliveryStatus?: string | null;
  systemEvent?: string | null;
  createdAt?: Timestamp;
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
