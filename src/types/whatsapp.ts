/**
 * TypeScript interfaces for Meta WhatsApp Cloud API webhook payloads
 * Reference: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-example
 */

/**
 * Root webhook payload structure
 * Reference: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components
 */
export interface WhatsAppWebhookPayload {
  object: string; // "whatsapp_business_account"
  entry: WhatsAppEntry[];
}

/**
 * Entry containing changes for a specific business account
 * Reference: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components#entry-object
 */
export interface WhatsAppEntry {
  id: string; // Business Account ID
  changes: WhatsAppChange[];
}

/**
 * Individual change event within an entry
 * Reference: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components#change-object
 */
export interface WhatsAppChange {
  value: WhatsAppValue;
  field: string; // Usually "messages"
}

/**
 * Change value containing metadata, messages, statuses, and errors
 * Reference: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components#value-object
 */
export interface WhatsAppValue {
  messaging_product: string; // "whatsapp"
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  messages?: WhatsAppMessage[];
  statuses?: WhatsAppMessageStatus[];
  errors?: WhatsAppError[];
}

/**
 * Discriminated union type for WhatsApp messages by type
 * Reference: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-example#messages-object
 */
export type WhatsAppMessage =
  | WhatsAppTextMessage
  | WhatsAppImageMessage
  | WhatsAppAudioMessage
  | WhatsAppVideoMessage
  | WhatsAppDocumentMessage
  | WhatsAppLocationMessage
  | WhatsAppContactsMessage
  | WhatsAppInteractiveMessage
  | WhatsAppButtonMessage
  | WhatsAppReactionMessage
  | WhatsAppSystemMessage;

/**
 * Base message structure with common fields
 * Reference: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-example#messages-object
 */
interface WhatsAppMessageBase {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  context?: {
    from?: string;
    id?: string;
  };
  errors?: Array<{
    code: number;
    title: string;
    message: string;
  }>;
}

/**
 * Text message
 * Reference: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-example#text-messages
 */
export interface WhatsAppTextMessage extends WhatsAppMessageBase {
  type: "text";
  text: {
    body: string;
  };
}

/**
 * Image message with media object
 * Reference: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-example#image-messages
 */
export interface WhatsAppImageMessage extends WhatsAppMessageBase {
  type: "image";
  image: {
    caption?: string;
    mime_type: string;
    sha256: string;
    id: string;
  };
}

/**
 * Audio message with media object
 * Reference: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-example#audio-messages
 */
export interface WhatsAppAudioMessage extends WhatsAppMessageBase {
  type: "audio";
  audio: {
    mime_type: string;
    sha256: string;
    id: string;
    voice?: boolean;
  };
}

/**
 * Video message with media object
 * Reference: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-example#video-messages
 */
export interface WhatsAppVideoMessage extends WhatsAppMessageBase {
  type: "video";
  video: {
    caption?: string;
    mime_type: string;
    sha256: string;
    id: string;
  };
}

/**
 * Document message with media object
 * Reference: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-example#document-messages
 */
export interface WhatsAppDocumentMessage extends WhatsAppMessageBase {
  type: "document";
  document: {
    caption?: string;
    filename?: string;
    mime_type: string;
    sha256: string;
    id: string;
  };
}

/**
 * Location message with geographic coordinates
 * Reference: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-example#location-messages
 */
export interface WhatsAppLocationMessage extends WhatsAppMessageBase {
  type: "location";
  location: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
}

/**
 * Contacts message containing one or more contact cards
 * Reference: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-example#contacts-messages
 */
export interface WhatsAppContactsMessage extends WhatsAppMessageBase {
  type: "contacts";
  contacts: WhatsAppContact[];
}

/**
 * Contact information within contacts message
 * Reference: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-example#contact-object
 */
export interface WhatsAppContact {
  addresses?: Array<{
    city?: string;
    country?: string;
    country_code?: string;
    state?: string;
    street?: string;
    type?: string;
    zip_code?: string;
  }>;
  birthday?: string;
  emails?: Array<{
    email?: string;
    type?: string;
  }>;
  name: {
    first_name: string;
    formatted_name: string;
    last_name?: string;
    middle_name?: string;
    name_prefix?: string;
    name_suffix?: string;
  };
  org?: {
    company?: string;
    department?: string;
    title?: string;
  };
  phones?: Array<{
    phone?: string;
    type?: string;
    wa_id?: string;
  }>;
  urls?: Array<{
    url?: string;
    type?: string;
  }>;
}

/**
 * Interactive message with buttons, lists, or product selections
 * Reference: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-example#interactive-messages
 */
export interface WhatsAppInteractiveMessage extends WhatsAppMessageBase {
  type: "interactive";
  interactive: {
    type: "button_reply" | "list_reply" | "product_reply" | "product_list_reply";
    button_reply?: {
      id: string;
      title: string;
    };
    list_reply?: {
      id: string;
      title: string;
      description: string;
    };
    product_reply?: {
      product_sku: string;
    };
    product_list_reply?: {
      product_list_info: {
        product_list_sku: string;
        product_items: Array<{
          product_sku: string;
        }>;
      };
    };
  };
}

/**
 * Button message with quick reply buttons
 * Reference: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-example#button-messages
 */
export interface WhatsAppButtonMessage extends WhatsAppMessageBase {
  type: "button";
  button: {
    payload: string;
    text: string;
  };
}

/**
 * Reaction message to another message
 * Reference: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-example#reaction-messages
 */
export interface WhatsAppReactionMessage extends WhatsAppMessageBase {
  type: "reaction";
  reaction: {
    message_id: string;
    emoji: string;
  };
}

/**
 * System message for account events (e.g., customer changes number)
 * Reference: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-example#system-messages
 */
export interface WhatsAppSystemMessage extends WhatsAppMessageBase {
  type: "system";
  system: {
    type:
      | "customer_changed_number"
      | "customer_identity_changed"
      | "customer_name_changed"
      | "user_identity_acknowledged"
      | "user_identity_not_acknowledged"
      | "security_code_changed";
    customer_changed_number?: {
      new_wa_id: string;
      old_wa_id: string;
    };
    customer_identity_changed?: {
      acknowledged: boolean;
      hash: string;
    };
    customer_name_changed?: {
      new_name: string;
    };
    user_identity_acknowledged?: Record<string, never>;
    user_identity_not_acknowledged?: Record<string, never>;
    security_code_changed?: Record<string, never>;
  };
}

/**
 * Message status update (delivery receipts, read receipts, etc.)
 * Reference: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-example#status-object
 */
export interface WhatsAppMessageStatus {
  id: string; // Message ID
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  recipient_id: string;
  errors?: Array<{
    code: number;
    title: string;
    message: string;
    error_data?: {
      details: string;
    };
  }>;
}

/**
 * Error object in webhook payload
 * Reference: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-example
 */
export interface WhatsAppError {
  code: number;
  title: string;
  message: string;
  error_data?: {
    details: string;
  };
}
