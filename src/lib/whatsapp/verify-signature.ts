/**
 * WhatsApp webhook signature verification using HMAC SHA-256.
 *
 * Meta WhatsApp sends the signature in the X-Hub-Signature-256 header
 * with the format: "sha256=<hex>"
 *
 * Required env var:
 *   WHATSAPP_APP_SECRET
 */

import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verifies the signature of a WhatsApp webhook request using HMAC SHA-256.
 *
 * @param rawBody - The raw request body as a string
 * @param signature - The signature from the X-Hub-Signature-256 header (format: "sha256=<hex>")
 * @returns true if the signature is valid, false otherwise
 *
 * This function never throws. If WHATSAPP_APP_SECRET is not set or the signature is invalid,
 * it logs a warning and returns false. Timing-safe comparison prevents timing attacks.
 */
export function verifyWhatsAppSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;

  // Check if secret is configured
  if (!secret) {
    console.warn('[WhatsApp Webhook] Signature validation failed: WHATSAPP_APP_SECRET is not set');
    return false;
  }

  // Check if signature is provided
  if (!signature) {
    console.warn('[WhatsApp Webhook] Signature validation failed: signature is missing');
    return false;
  }

  try {
    // Extract the hex value from "sha256=<hex>" format
    const signatureParts = signature.split('=');
    if (signatureParts.length !== 2 || signatureParts[0] !== 'sha256') {
      console.warn('[WhatsApp Webhook] Signature validation failed: invalid signature format');
      return false;
    }

    const receivedSignature = signatureParts[1];

    // Calculate expected signature using HMAC SHA-256
    const expectedSignature = createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    // Compare signatures using timing-safe comparison to prevent timing attacks
    const receivedBuffer = Buffer.from(receivedSignature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    // Ensure buffers have the same length before comparison
    if (receivedBuffer.length !== expectedBuffer.length) {
      console.warn('[WhatsApp Webhook] Signature validation failed: signature length mismatch');
      return false;
    }

    const isValid = timingSafeEqual(receivedBuffer, expectedBuffer);
    return isValid;
  } catch (error) {
    console.error(
      '[WhatsApp Webhook] Unexpected error during signature validation:',
      error instanceof Error ? error.message : String(error)
    );
    return false;
  }
}
