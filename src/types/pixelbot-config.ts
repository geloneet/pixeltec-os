/**
 * Tipos de la UI de configuración de PixelBot Fase A (personalidad, memoria,
 * escalamiento, ejemplos few-shot, timing, versionado, playground).
 *
 * Excepción puntual al freeze de v1.0 (2026-07-11) — ver
 * `04_PRODUCTOS/PixelTEC OS/PixelTEC OS.md` en NeuroPIXEL. Solo DEV.
 *
 * Espejo 1:1 de los shapes reales de `agent/bot_config.py::DEFAULTS`,
 * `agent/examples.py::_row_to_dict`, `agent/conversation_memory.py` y
 * `agent/main.py::simular_respuesta` en pixelbot@e5005f1a / @b87e899
 * (verificado en código, no inferido).
 */

import type { BotConfig } from "@/types/whatsapp-inbox";

// ── Config extendida (Fase A) ────────────────────────────────────────────────

export type BotFormality = "formal" | "casual_profesional" | "tecnico";
export type EmojiLevel = "ninguno" | "bajo" | "medio";

export interface BotEmojiUsage {
  level: EmojiLevel;
  max_count: number;
  never_in: string[];
}

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

/** Claves de motivo de escalamiento — las 3 que el LLM distingue hoy de forma
 * determinista (marcadores <<ESCALAR_LEAD|ASESOR|DUDA>>). */
export type EscalationReason = "lead" | "escalate" | "unknown";

export interface BotEscalation {
  confidence_threshold: number;
  max_clarify_attempts: number;
  messages: Record<EscalationReason, string>;
  priority: string;
}

export interface BotTiming {
  min_delay_seconds: number;
  max_delay_seconds: number;
  vary_by_length: boolean;
  disabled: boolean;
}

/** Config completa Fase A — el objeto que viaja en `config` en todos los
 * endpoints de /internal/config*. Extiende el shape legacy (`BotConfig`,
 * en `whatsapp-inbox.ts`) con las 4 secciones nuevas. */
export interface BotConfigV2 extends BotConfig {
  personality: BotPersonality;
  response_policy: BotResponsePolicy;
  escalation: BotEscalation;
  timing: BotTiming;
  /** Presente solo cuando viene de una versión activa (GET /internal/config,
   * publish, rollback) — ausente en create_draft. */
  version?: number;
}

// ── Versionado ────────────────────────────────────────────────────────────────

export type ConfigVersionStatus = "draft" | "active" | "archived";

/** GET /internal/config/versions → { versions: ConfigVersionMeta[] } */
export interface ConfigVersionMeta {
  version: number;
  status: ConfigVersionStatus;
  created_at: string;
  created_by: string | null;
  published_at: string | null;
}

/** POST /internal/config/draft → shape exacto de create_draft() */
export interface ConfigDraftResult {
  version: number;
  status: "draft";
  config: BotConfigV2;
}

// ── Ejemplos few-shot ─────────────────────────────────────────────────────────
// Backend NO soporta editar ni borrar — solo create + list + toggle active.

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
  created_by: string | null;
}

export interface BotExampleCreateInput {
  customer_msg: string;
  ideal_reply: string;
  category?: string | null;
  intent?: string | null;
  tags: string[];
  manual_priority: number;
  active: boolean;
}

// ── Memoria estructurada (solo lectura) ──────────────────────────────────────

export type MemorySource = "customer" | "inferred";

export interface MemoryEntry {
  key: string;
  value: string;
  source: MemorySource;
  confidence: number | null;
  expires_at: string | null;
  updated_at: string;
}

// ── Playground / simulación ──────────────────────────────────────────────────

export interface SimulateExampleUsed {
  customer_msg: string;
  ideal_reply: string;
  score: number;
}

/** POST /internal/simulate → shape exacto del `resultado` de
 * simular_respuesta(), + simulacion/version_simulada agregados por la ruta. */
export interface SimulateResult {
  modo: string;
  fuera_de_horario: boolean;
  respuesta: string | null;
  escalaria: boolean;
  razon_escalamiento: EscalationReason | null;
  intent_detectado: string | null;
  confianza: number | null;
  ejemplos_seleccionados: SimulateExampleUsed[];
  memoria_usada: Record<string, string>;
  memoria_nueva_detectada: Record<string, string> | null;
  reglas_aplicadas: string[];
  prompt_preview: string | null;
  simulacion: true;
  version_simulada: number | null;
}
