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
  createdAt?: string;
  updatedAt?: string;
}

export interface ContactNote { id: string; text: string; createdBy: string; createdAt?: string; }

// ── Memoria del bot por contacto (PixelBot Fase A) ──────────────────────────
// Shape espejo de agent/conversation_memory.py::list_memory_raw. Read-only
// desde PixelTEC OS — el bot es la única fuente de verdad de lo que recuerda.
export type BotMemoryKey =
  | 'name' | 'company' | 'service' | 'budget' | 'target_date'
  | 'lead_state' | 'last_intent' | 'asked_fields' | 'requested_human' | 'summary';

export interface BotMemoryEntry {
  key: BotMemoryKey;
  value: string;
  source: 'customer' | 'inferred';
  confidence: number | null;
  expires_at: string | null;
  updated_at: string;
}

// ── Biblioteca de ejemplos few-shot (PixelBot Fase A) ───────────────────────
// Shape espejo de agent/examples.py::_row_to_dict.
export interface BotExample {
  id: number;
  customer_msg: string;
  ideal_reply: string;
  category: string | null;
  intent: string | null;
  tags: string[];
  manual_priority: number;
  active: boolean;
  created_at: string;
  created_by: string;
}

// ── Versionado de config + playground de simulación (PixelBot Fase A) ──────
export type BotConfigVersionStatus = 'draft' | 'active' | 'archived';
export interface BotConfigVersion {
  version: number;
  status: BotConfigVersionStatus;
  created_at: string;
  created_by: string;
  published_at: string | null;
}

/**
 * Shape espejo de agent/main.py::simular_respuesta — pipeline completo
 * (prompt, ejemplos, memoria, escalamiento) sin enviar nada a WhatsApp ni
 * persistir. Construido para la pantalla "Probar personalidad".
 */
export interface SimulateResult {
  modo: string;
  fuera_de_horario: boolean;
  respuesta: string | null;
  escalaria: boolean;
  razon_escalamiento: string | null;
  intent_detectado: string | null;
  confianza: number | null;
  ejemplos_seleccionados: unknown[];
  memoria_usada: Record<string, unknown>;
  memoria_nueva_detectada: unknown;
  reglas_aplicadas: string[];
  prompt_preview: string | null;
  simulacion: true;
  version_simulada: number | null;
}

export const MEMORY_KEY_LABELS: Record<BotMemoryKey, string> = {
  name: 'Nombre',
  company: 'Empresa',
  service: 'Servicio de interés',
  budget: 'Presupuesto',
  target_date: 'Fecha objetivo',
  lead_state: 'Estado del lead',
  last_intent: 'Última intención',
  asked_fields: 'Datos ya preguntados',
  requested_human: 'Pidió humano',
  summary: 'Resumen',
};

export interface BotSchedule { days: number[]; start: string; end: string; }

// ── Personalidad y comportamiento (PixelBot Fase A / ADR-001) ──────────────
// Shapes espejo de agent/bot_config.py::DEFAULTS en el repo pixelbot. Opcionales
// en BotConfig porque un backend viejo (sin Fase A) no los devolvería.
export type BotFormality = 'formal' | 'casual_profesional' | 'tecnico';
export type BotEmojiLevel = 'ninguno' | 'bajo' | 'medio';

export interface BotEmojiUsage { level: BotEmojiLevel; max_count: number; never_in: string[]; }

export interface BotPersonality {
  public_identity: string;
  traits: string[];
  formality: BotFormality;
  language_variant: string;
  emoji_usage: BotEmojiUsage;
  lists_usage: string;
  preferred_phrases: string[];
  forbidden_phrases: string[];
  greeting_style: string;
  farewell_style: string;
  error_ack_style: string;
  ask_missing_data_style: string;
}

export interface BotResponsePolicy {
  one_question_per_turn: boolean;
  no_repeat_greeting: boolean;
  no_repeat_known_data: boolean;
  length_preference: string;
  acknowledge_uncertainty: boolean;
  no_invent: string[];
}

export interface BotEscalationMessages { lead: string; escalate: string; unknown: string; }
export interface BotEscalation {
  confidence_threshold: number;
  max_clarify_attempts: number;
  messages: BotEscalationMessages;
  priority: string;
}

export interface BotTiming {
  min_delay_seconds: number;
  max_delay_seconds: number;
  vary_by_length: boolean;
  disabled: boolean;
}

export interface BotConfig {
  bot_name: string; tone: BotTone; response_delay_seconds: number;
  schedule: BotSchedule; out_of_hours_message: string; initial_message: string;
  escalation_message: string; can_answer: string[]; cannot_answer: string[];
  escalation_rules: string[]; quote_questions: string[];
  personality?: BotPersonality;
  response_policy?: BotResponsePolicy;
  escalation?: BotEscalation;
  timing?: BotTiming;
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
  cliente:   { label: 'Cliente',   className: 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/30' },
  prospecto: { label: 'Prospecto', className: 'text-violet-700 dark:text-violet-300 bg-violet-500/10 border-violet-500/30' },
  soporte:   { label: 'Soporte',   className: 'text-orange-700 dark:text-orange-300 bg-orange-500/10 border-orange-500/30' },
  proveedor: { label: 'Proveedor', className: 'text-blue-700 dark:text-blue-300 bg-blue-500/10 border-blue-500/30' },
  spam:      { label: 'Spam',      className: 'text-red-700 dark:text-red-300 bg-red-500/10 border-red-500/30' },
  otro:      { label: 'Otro',      className: 'text-muted-foreground bg-muted border-border' },
};
