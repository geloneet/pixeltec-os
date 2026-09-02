import { NextRequest, NextResponse } from "next/server";
import { requireWhatsAppReviewAccess } from "@/lib/auth-guards";
import { parseJsonBody } from "@/lib/whatsapp-inbox/errors";
import {
  createMessageTemplate,
  describeManagementError,
  getManagementConfig,
  listMessageTemplates,
} from "@/lib/whatsapp/management";
import type { TemplatesResponse } from "@/lib/whatsapp/management-types";
import { TemplateValidationError, validateTemplateInput } from "@/lib/whatsapp/template-builder";

/**
 * `GET`/`POST /api/whatsapp-inbox/templates` — plantillas (WO-2026-00181).
 *
 * El POST es la acción que Meta exige ver funcionando para aprobar
 * `whatsapp_business_management`. Tres fallos deliberadamente distintos:
 *
 *  - **400 `invalid_template`** — la entrada no pasa el builder puro. `details`
 *    lleva la lista completa de errores (texto nuestro, en español): un
 *    diálogo que corrige un campo por intento no se puede grabar.
 *  - **502 `meta_error`** — Meta la rechazó. El status de Graph no se propaga
 *    tal cual: el fallo es de un tercero, no de esta API.
 *  - **503 `not_configured`** — faltan env. No se llama a Meta ni se finge un
 *    éxito.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function statusDeSalida(failure: { status: number; code: string }): number {
  return failure.code === "meta_error" ? 502 : failure.status;
}

export async function GET(req: NextRequest) {
  const guard = await requireWhatsAppReviewAccess(req.cookies.get("__session")?.value, {
    route: "/api/whatsapp-inbox/templates",
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const config = getManagementConfig();
  if (!config.configured) {
    // Igual que en /account: la ausencia de configuración se declara, no se
    // convierte en un 500 que el revisor lea como app rota.
    const body: TemplatesResponse = { configured: false, missing: config.missing, templates: [] };
    return NextResponse.json(body);
  }

  try {
    const templates = await listMessageTemplates();
    const body: TemplatesResponse = { configured: true, templates };
    return NextResponse.json(body);
  } catch (error) {
    const failure = describeManagementError(error, "No se pudieron cargar las plantillas.");
    return NextResponse.json(
      { error: failure.message, code: failure.code },
      { status: statusDeSalida(failure) }
    );
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireWhatsAppReviewAccess(req.cookies.get("__session")?.value, {
    route: "/api/whatsapp-inbox/templates",
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const parsed = await parseJsonBody<unknown>(req);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Cuerpo JSON inválido", code: "invalid_body" }, { status: 400 });
  }

  // Validar ANTES de mirar la configuración: un error de forma es del usuario y
  // no depende de que la cuenta esté conectada.
  const validated = validateTemplateInput(parsed.value);
  if (!validated.ok) {
    return NextResponse.json(
      {
        error: "La plantilla no es válida.",
        code: "invalid_template",
        details: validated.errors,
      },
      { status: 400 }
    );
  }

  const config = getManagementConfig();
  if (!config.configured) {
    return NextResponse.json(
      {
        error: "WhatsApp Business Management no está configurado.",
        code: "not_configured",
        missing: config.missing,
      },
      { status: 503 }
    );
  }

  try {
    const created = await createMessageTemplate(validated.value);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    // Red de seguridad: el builder vuelve a validar dentro del cliente, así que
    // un desajuste entre ambas capas sale como 400, no como 500.
    if (error instanceof TemplateValidationError) {
      return NextResponse.json(
        { error: "La plantilla no es válida.", code: "invalid_template", details: error.errors },
        { status: 400 }
      );
    }
    const failure = describeManagementError(error, "No se pudo crear la plantilla.");
    return NextResponse.json(
      { error: failure.message, code: failure.code },
      { status: statusDeSalida(failure) }
    );
  }
}
