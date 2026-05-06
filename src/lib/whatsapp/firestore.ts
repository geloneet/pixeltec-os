/**
 * Firestore persistence module for WhatsApp webhook events.
 * Uses Firebase Admin SDK exclusively (server-side only).
 *
 * All functions swallow internal errors — the webhook must never return 500
 * to Meta because of Firestore failures.
 */

import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore } from '@/lib/firebase-admin';
import type {
  WhatsAppMessage,
  WhatsAppMessageStatus,
  WhatsAppError,
} from '@/types/whatsapp';

const COLLECTIONS = {
  messages: 'whatsappMessages',
  errors: 'whatsappErrors',
} as const;

/**
 * Represents the contact object from the Meta webhook `contacts[]` array.
 * This differs from `WhatsAppContact` (which is for contact *cards* in messages).
 * Meta sends: `{ profile: { name: string }, wa_id: string }`.
 */
export interface WhatsAppWebhookContact {
  profile?: { name?: string };
  wa_id: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function extractContent(message: WhatsAppMessage): unknown {
  switch (message.type) {
    case 'text':
      return message.text.body;
    case 'image':
      return { id: message.image.id, caption: message.image.caption, mimeType: message.image.mime_type };
    case 'audio':
      return { id: message.audio.id };
    case 'video':
      return { id: message.video.id, caption: message.video.caption };
    case 'document':
      return { id: message.document.id, filename: message.document.filename, caption: message.document.caption };
    case 'location':
      return { lat: message.location.latitude, lng: message.location.longitude, name: message.location.name };
    case 'contacts':
      // Contact card messages store only the count; full contact data is in rawPayload
      return { count: message.contacts.length };
    case 'interactive':
      return message.interactive;
    case 'button':
      return message.button;
    case 'reaction':
      return message.reaction;
    case 'system':
      return message.system;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Persists an incoming WhatsApp message to `whatsappMessages/{message.id}`.
 * Returns the message ID on success, or an empty string on failure.
 */
export async function saveIncomingMessage(
  message: WhatsAppMessage,
  contact: WhatsAppWebhookContact,
  metadata: { phoneNumberId: string; displayPhoneNumber: string },
): Promise<string> {
  try {
    const db = getAdminFirestore();
    const ref = db.collection(COLLECTIONS.messages).doc(message.id);

    // Convert Unix timestamp string to ISO-8601
    const timestamp = new Date(parseInt(message.timestamp, 10) * 1000).toISOString();

    await ref.set({
      id: message.id,
      from: message.from,
      to: metadata.phoneNumberId,
      type: message.type,
      content: extractContent(message),
      timestamp,
      contactName: contact.profile?.name ?? null,
      contactWaId: contact.wa_id,
      displayPhoneNumber: metadata.displayPhoneNumber,
      rawPayload: JSON.parse(JSON.stringify(message)) as Record<string, unknown>,
      createdAt: FieldValue.serverTimestamp(),
      status: 'received',
    });

    console.info(`[WhatsApp Firestore] Saved message id=${message.id} type=${message.type}`);
    return message.id;
  } catch (err) {
    console.error('[WhatsApp Firestore] saveIncomingMessage failed:', err instanceof Error ? err.message : err);
    return '';
  }
}

/**
 * Appends a status event to an existing `whatsappMessages/{status.id}` document
 * and updates the `latestStatus` top-level field.
 */
export async function saveStatusUpdate(status: WhatsAppMessageStatus): Promise<void> {
  try {
    const db = getAdminFirestore();
    const ref = db.collection(COLLECTIONS.messages).doc(status.id);

    await ref.set(
      {
        statusEvents: FieldValue.arrayUnion({ status: status.status, timestamp: new Date(parseInt(status.timestamp, 10) * 1000).toISOString(), recipientId: status.recipient_id }),
        latestStatus: status.status,
      },
      { merge: true }
    );

    console.info(`[WhatsApp Firestore] Status update id=${status.id} status=${status.status}`);
  } catch (err) {
    console.error('[WhatsApp Firestore] saveStatusUpdate failed:', err instanceof Error ? err.message : err);
  }
}

/**
 * Saves a webhook error event to the `whatsappErrors` collection
 * (auto-generated document ID).
 */
export async function saveErrorEvent(error: WhatsAppError, context: string): Promise<void> {
  try {
    const db = getAdminFirestore();
    await db.collection(COLLECTIONS.errors).add({
      code: error.code,
      title: error.title,
      message: error.message ?? null,
      context,
      createdAt: FieldValue.serverTimestamp(),
    });

    console.info(`[WhatsApp Firestore] Error event saved code=${error.code} title=${error.title}`);
  } catch (err) {
    console.error('[WhatsApp Firestore] saveErrorEvent failed:', err instanceof Error ? err.message : err);
  }
}
