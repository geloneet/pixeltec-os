'use server';

import { headers } from 'next/headers';
import { enforceRateLimit, resetRateLimit } from '@/lib/rate-limit';
import { sendEmail } from '@/lib/email';
import type { PortalActionResult } from '@/lib/action-types';
import { renderClientPortalAccessEmail } from '@/emails/ClientPortalAccessEmail';
import { generateAccessCode, hashAccessCode, accessCodeMatches } from './otp';
import { createPortalSessionCookie, clearPortalSessionCookie } from './cookie';
import {
  findSinglePortalClientByEmail,
  getClientCodeState,
  setClientAccessCode,
  clearClientAccessCode,
} from './pg';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:9002';
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutos
const OTP_CLIENT_RATE_LIMIT_MS = 60 * 1000; // 60s entre solicitudes por cliente
const OTP_IP_MAX = 10;
const OTP_IP_WINDOW_MS = 60 * 60 * 1000; // 1 hora

// Mismo mensaje para: correo inexistente, portal desactivado, correo duplicado
// entre clientes, Y rate-limit por cliente — ninguno de esos casos debe ser
// distinguible desde afuera (anti-enumeración + anti-ambigüedad). Solo el
// rate-limit por IP se muestra honesto, porque no depende de si el correo existe.
const GENERIC_OTP_MESSAGE = 'Si el correo existe y tiene el portal activo, te enviamos un código de acceso.';

function portalSessionSecret(): string {
  const secret = process.env.PORTAL_SESSION_SECRET;
  if (!secret) throw new Error('PORTAL_SESSION_SECRET no está configurado.');
  return secret;
}

export async function requestClientPortalCodeAction(email: string): Promise<PortalActionResult<{ message: string }>> {
  const trimmedEmail = email.trim();
  if (!trimmedEmail) return { success: true, data: { message: GENERIC_OTP_MESSAGE } };

  const headersList = await headers();
  const ip =
    headersList.get('x-forwarded-for')?.split(',')[0].trim() ?? headersList.get('x-real-ip') ?? 'unknown';
  const rl = await enforceRateLimit({ ip, bucket: 'client_portal_otp', max: OTP_IP_MAX, windowMs: OTP_IP_WINDOW_MS });
  if (!rl.allowed) {
    return { success: false, error: 'Demasiadas solicitudes. Inténtalo más tarde.' };
  }

  const client = await findSinglePortalClientByEmail(trimmedEmail);
  if (!client || !client.portalAccessEnabled) {
    return { success: true, data: { message: GENERIC_OTP_MESSAGE } };
  }

  const codeState = await getClientCodeState(client.id);
  if (
    codeState?.lastCodeRequestAt &&
    Date.now() - codeState.lastCodeRequestAt.getTime() < OTP_CLIENT_RATE_LIMIT_MS
  ) {
    return { success: true, data: { message: GENERIC_OTP_MESSAGE } };
  }

  const code = generateAccessCode();
  await setClientAccessCode(client.id, hashAccessCode(code, portalSessionSecret()), new Date(Date.now() + OTP_TTL_MS));
  await resetRateLimit({ ip: client.id, bucket: 'client_portal_otp_verify_client' });

  const html = renderClientPortalAccessEmail({
    clientName: client.name,
    code,
    expiresIn: '10 minutos',
    portalUrl: `${APP_URL}/portal`,
  });
  const emailResult = await sendEmail(client.email, '🔐 Tu código de acceso al portal — PixelTEC', html);
  if (!emailResult.success) {
    console.error('[client-portal] requestCode: fallo enviando email de OTP', emailResult.error);
    return { success: false, error: 'No se pudo enviar el código. Intenta de nuevo en unos minutos.' };
  }

  return { success: true, data: { message: GENERIC_OTP_MESSAGE } };
}

export async function verifyClientPortalCodeAction(email: string, code: string): Promise<PortalActionResult<null>> {
  const trimmedCode = code.trim().replace(/\D/g, '');
  if (trimmedCode.length !== 6) return { success: false, error: 'El código debe tener 6 dígitos.' };

  const headersList = await headers();
  const ip =
    headersList.get('x-forwarded-for')?.split(',')[0].trim() ?? headersList.get('x-real-ip') ?? 'unknown';
  const ipRl = await enforceRateLimit({ ip, bucket: 'client_portal_otp_verify_ip', max: 20, windowMs: 60 * 60 * 1000 });
  if (!ipRl.allowed) return { success: false, error: 'Demasiados intentos. Inténtalo más tarde.' };

  const client = await findSinglePortalClientByEmail(email.trim());
  if (!client || !client.portalAccessEnabled) return { success: false, error: 'Código incorrecto.' };

  // Límite de intentos fallidos por cliente, no solo por IP — un atacante
  // podría rotar de IP para evitar el límite anterior. Reusa enforceRateLimit
  // con el id del cliente como clave (no una IP real; ver el comentario de
  // `ip` en RateLimitInput — solo es una cadena que se hashea para la
  // clave del bucket). Agota el margen de fuerza bruta sobre un mismo
  // código dentro de su propia ventana de vigencia (10 min) — al superarse,
  // se invalida el código vigente y hay que solicitar uno nuevo.
  const clientRl = await enforceRateLimit({
    ip: client.id,
    bucket: 'client_portal_otp_verify_client',
    max: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (!clientRl.allowed) {
    await clearClientAccessCode(client.id);
    return { success: false, error: 'Demasiados intentos incorrectos. Solicita un código nuevo.' };
  }

  const codeState = await getClientCodeState(client.id);
  if (!codeState?.accessCodeHash || !accessCodeMatches(codeState.accessCodeHash, trimmedCode, portalSessionSecret())) {
    return { success: false, error: 'Código incorrecto.' };
  }
  if (!codeState.accessCodeExpiresAt || codeState.accessCodeExpiresAt < new Date()) {
    return { success: false, error: 'El código expiró. Solicita uno nuevo.' };
  }

  await clearClientAccessCode(client.id);
  await createPortalSessionCookie(client.publicId);
  return { success: true, data: null };
}

export async function logoutClientPortalAction(): Promise<void> {
  await clearPortalSessionCookie();
}
