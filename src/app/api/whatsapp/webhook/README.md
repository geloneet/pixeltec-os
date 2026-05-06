# WhatsApp Cloud API Webhook

## Purpose

This webhook receives events from Meta's WhatsApp Cloud API, including incoming messages, delivery status updates, and error notifications. Events are processed and stored in Firestore for PIXELTEC.MX's WhatsApp bot.

## Public URL

```
https://pixeltec.mx/api/whatsapp/webhook
```

## Required Environment Variables

- `WHATSAPP_APP_SECRET` — App secret from Meta Dashboard, used for HMAC SHA-256 signature validation
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN` — Verification token sent to Meta, echoed back during webhook setup
- `WHATSAPP_PHONE_NUMBER_ID` — Reserved for future send API use
- `WHATSAPP_BUSINESS_ACCOUNT_ID` — Reserved for future send API use
- `WHATSAPP_APP_ID` — Reserved for future send API use
- `WHATSAPP_API_VERSION` — Reserved for future send API use

## Testing Locally with curl

### GET Verification

Test the webhook verification flow:

```bash
curl -i "http://localhost:3000/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test123"
```

Expected response:
- HTTP 200
- Body: `test123`

### POST with Fake Signature

Test message handling (will fail validation, which is correct):

```bash
curl -i -X POST http://localhost:3000/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -H "x-hub-signature-256: sha256=invalid" \
  -d '{"object":"whatsapp_business_account","entry":[]}'
```

Expected response:
- HTTP 401 (Unauthorized) — signature validation failed, which is the correct behavior

## Configuring in Meta Dashboard

1. Go to **Meta for Developers** → Your App → **WhatsApp** → **Configuration**
2. Set **Webhook URL** to: `https://pixeltec.mx/api/whatsapp/webhook`
3. Set **Verify Token** to the value of `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
4. Under **Subscribe to fields**, select: `messages`
5. Reference: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks

## Firestore Structure Created

The webhook creates and populates the following Firestore collections:

- `whatsappMessages/{messageId}` — Incoming messages and status events from WhatsApp
- `whatsappErrors/{autoId}` — Error events extracted from Meta webhook payloads

## Debugging Common Errors

### 401 from POST

**Problem:** Signature validation failed  
**Solution:** Verify that `WHATSAPP_APP_SECRET` in your `.env.production` matches the app secret shown in Meta Dashboard. The signature is computed using HMAC SHA-256 over the request body.

### 403 from GET

**Problem:** Verify token mismatch during webhook setup  
**Solution:** Ensure `WHATSAPP_WEBHOOK_VERIFY_TOKEN` matches the token you entered in Meta Dashboard.

### Messages not appearing in Firestore

**Cause:** Firebase Admin credentials or Firestore rules issue  
**Solution:**
- Verify Firebase Admin env vars are set correctly (`FIREBASE_PRIVATE_KEY`, `FIREBASE_PROJECT_ID`, etc.)
- Check Firestore security rules allow writes to `whatsappMessages` and `whatsappErrors` collections

### Viewing logs in Docker

```bash
docker logs pixeltec-os --tail 100 -f
```

Look for log lines starting with `[WhatsApp Webhook]` to trace request processing.
