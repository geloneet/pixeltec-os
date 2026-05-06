import { NextRequest } from 'next/server';
import { verifyWhatsAppSignature } from '@/lib/whatsapp/verify-signature';
import { saveIncomingMessage, saveStatusUpdate, saveErrorEvent } from '@/lib/whatsapp/firestore';
import type { WhatsAppWebhookPayload } from '@/types/whatsapp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — Meta webhook verification
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  console.log('[WhatsApp Webhook] GET verify request received');

  const { searchParams } = req.nextUrl;
  const hubMode = searchParams.get('hub.mode');
  const hubVerifyToken = searchParams.get('hub.verify_token');
  const hubChallenge = searchParams.get('hub.challenge');

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (!verifyToken) {
    console.warn('[WhatsApp Webhook] Verification failed — WHATSAPP_WEBHOOK_VERIFY_TOKEN is not set');
    return new Response('Forbidden', { status: 403 });
  }

  if (hubMode === 'subscribe' && hubVerifyToken === verifyToken) {
    console.log('[WhatsApp Webhook] Verification successful');
    return new Response(hubChallenge, { status: 200 });
  }

  console.warn('[WhatsApp Webhook] Verification failed — token mismatch or wrong mode');
  return new Response('Forbidden', { status: 403 });
}

// ---------------------------------------------------------------------------
// POST — incoming WhatsApp events
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  const isValid = verifyWhatsAppSignature(rawBody, req.headers.get('x-hub-signature-256'));
  if (!isValid) {
    console.warn('[WhatsApp Webhook] Invalid signature — rejecting request');
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody) as WhatsAppWebhookPayload;

    if (payload.object !== 'whatsapp_business_account') {
      console.log('[WhatsApp Webhook] Ignoring non-WhatsApp payload');
      return new Response('OK', { status: 200 });
    }

    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        const value = change.value;

        if (value.messages) {
          for (const message of value.messages) {
            const contact = value.contacts?.[0] ?? { wa_id: message.from, profile: undefined };
            console.log(`[WhatsApp Webhook] Message received from ${message.from} type: ${message.type}`);
            await saveIncomingMessage(
              message,
              contact,
              {
                phoneNumberId: value.metadata.phone_number_id,
                displayPhoneNumber: value.metadata.display_phone_number,
              },
            );
          }
        }

        if (value.statuses) {
          for (const status of value.statuses) {
            console.log(`[WhatsApp Webhook] Status update: id=${status.id} status=${status.status}`);
            await saveStatusUpdate(status);
          }
        }

        if (value.errors) {
          for (const error of value.errors) {
            console.warn(`[WhatsApp Webhook] Error in payload: code=${error.code} title=${error.title}`);
            await saveErrorEvent(error, 'webhook-value');
          }
        }
      }
    }
  } catch (err) {
    console.error('[WhatsApp Webhook] Unexpected error:', err);
    return new Response('OK', { status: 200 });
  }

  return new Response('OK', { status: 200 });
}
