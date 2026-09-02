/**
 * Tipos del contrato de GESTIÓN de WhatsApp Business (WO-2026-00181).
 *
 * Viven aparte de `management.ts` a propósito: la UI (`src/components/...`)
 * importa SOLO de aquí, así que puede tipar sus vistas sin arrastrar el cliente
 * de Graph —ni su lectura de env— a un bundle de cliente.
 *
 * Nada de lo que se declara aquí transporta credenciales: el token de Meta no
 * sale nunca de `management.ts`, ni siquiera hacia el servidor de rutas.
 */

/** Estado del número de WhatsApp Business, tal como lo expone Graph. */
export interface PhoneNumberInfo {
  /** Phone Number ID (no es el teléfono; es el id del activo en Meta). */
  id: string;
  /** Número en formato legible, ej. "+52 1 322 137 8336". */
  displayPhoneNumber: string | null;
  /** Nombre verificado que ve el cliente. */
  verifiedName: string | null;
  /** GREEN | YELLOW | RED | UNKNOWN — calidad según Meta. */
  qualityRating: string | null;
  /** APPROVED | PENDING_REVIEW | DECLINED… — estado del nombre. */
  nameStatus: string | null;
  /** VERIFIED | NOT_VERIFIED | EXPIRED. */
  codeVerificationStatus: string | null;
  /** TIER_50 | TIER_250 | TIER_1K… — límite de conversaciones iniciadas. */
  messagingLimitTier: string | null;
  /** CLOUD_API | ON_PREMISE | NOT_APPLICABLE. */
  platformType: string | null;
}

/** Perfil de empresa del número (solo lectura en este WO). */
export interface BusinessProfile {
  about: string | null;
  address: string | null;
  description: string | null;
  email: string | null;
  profilePictureUrl: string | null;
  websites: string[];
  vertical: string | null;
}

/**
 * Componente de una plantilla YA existente, reducido a lo que la UI muestra.
 * Meta devuelve más campos (botones, ejemplos, límites); no se propagan porque
 * ninguna vista los usa y cada campo extra es superficie que hay que sanear.
 */
export interface MessageTemplateComponent {
  type: string;
  format: string | null;
  text: string | null;
}

/** Plantilla tal como la lista Graph. */
export interface MessageTemplate {
  id: string;
  name: string;
  language: string;
  /** APPROVED | PENDING | REJECTED | PAUSED | DISABLED. */
  status: string;
  category: string;
  components: MessageTemplateComponent[];
  rejectedReason: string | null;
  qualityScore: string | null;
}

/** Idiomas admitidos al CREAR una plantilla desde esta superficie. */
export type TemplateLanguage = "es_MX" | "es" | "en_US" | "en";

/**
 * Categorías admitidas. `AUTHENTICATION` se excluye a propósito: exige
 * plantillas de código de un solo uso con reglas propias de Meta y no forma
 * parte del caso de uso que se demuestra en el App Review.
 */
export type TemplateCategory = "UTILITY" | "MARKETING";

/** Entrada validada para crear una plantilla. */
export interface TemplateCreateInput {
  name: string;
  language: TemplateLanguage;
  category: TemplateCategory;
  body: string;
  /** Un ejemplo por variable `{{n}}` del cuerpo; `[]` si no hay variables. */
  examples: string[];
  footer?: string;
  headerText?: string;
}

/** Resultado de crear una plantilla (lo que responde `POST /templates`). */
export interface TemplateCreated {
  id: string;
  status: string;
  name: string;
}

/** Respuesta de `GET /api/whatsapp-inbox/account`. */
export interface AccountResponse {
  configured: boolean;
  /** Variables de entorno que faltan cuando `configured` es false. */
  missing?: string[];
  phone?: PhoneNumberInfo;
  profile?: BusinessProfile;
  /** Mensajes saneados de las lecturas que fallaron (nunca el cuerpo de Meta). */
  errors?: string[];
}

/** Respuesta de `GET /api/whatsapp-inbox/templates`. */
export interface TemplatesResponse {
  configured: boolean;
  missing?: string[];
  templates: MessageTemplate[];
}
