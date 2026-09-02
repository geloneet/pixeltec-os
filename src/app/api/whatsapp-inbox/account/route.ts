import { NextRequest, NextResponse } from "next/server";
import { requireWhatsAppReviewAccess } from "@/lib/auth-guards";
import {
  describeManagementError,
  getBusinessProfile,
  getManagementConfig,
  getPhoneNumberInfo,
} from "@/lib/whatsapp/management";
import type { AccountResponse } from "@/lib/whatsapp/management-types";

/**
 * `GET /api/whatsapp-inbox/account` — número y perfil de empresa (WO-2026-00181).
 *
 * Superficie de lectura de `whatsapp_business_management` para el revisor de
 * Meta. Dos decisiones de contrato:
 *
 *  1. **Sin configurar NO es un error**: 200 con `configured:false` y las env
 *     que faltan. Un 500 aquí le dice al revisor «la app está rota», que es
 *     justo el motivo por el que Meta rechaza una App Review.
 *  2. **Las dos lecturas son independientes**: si una falla, la otra se
 *     devuelve igual con un `errors` saneado. Solo cuando fallan ambas sale un
 *     status de error, con el del primer fallo (502 si lo rechazó Meta).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Un fallo de Graph nunca se convierte en el status de esta API: sale como 502. */
function statusDeSalida(failure: { status: number; code: string }): number {
  return failure.code === "meta_error" ? 502 : failure.status;
}

export async function GET(req: NextRequest) {
  const guard = await requireWhatsAppReviewAccess(req.cookies.get("__session")?.value, {
    route: "/api/whatsapp-inbox/account",
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const config = getManagementConfig();
  if (!config.configured) {
    const body: AccountResponse = { configured: false, missing: config.missing };
    return NextResponse.json(body);
  }

  const [phone, profile] = await Promise.allSettled([getPhoneNumberInfo(), getBusinessProfile()]);

  const body: AccountResponse = { configured: true };
  const fallos: Array<{ status: number; message: string; code: string }> = [];

  if (phone.status === "fulfilled") {
    body.phone = phone.value;
  } else {
    fallos.push(describeManagementError(phone.reason, "No se pudo leer el número de WhatsApp."));
  }

  if (profile.status === "fulfilled") {
    body.profile = profile.value;
  } else {
    fallos.push(describeManagementError(profile.reason, "No se pudo leer el perfil de empresa."));
  }

  if (fallos.length === 0) return NextResponse.json(body);

  body.errors = fallos.map((f) => f.message);

  // Fallo parcial: 200 — la vista se dibuja con lo que sí llegó.
  if (fallos.length === 1) return NextResponse.json(body);

  const primero = fallos[0];
  return NextResponse.json(
    { ...body, error: primero.message, code: primero.code },
    { status: statusDeSalida(primero) }
  );
}
