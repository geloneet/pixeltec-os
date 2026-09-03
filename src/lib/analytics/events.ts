/**
 * Catálogo de eventos de contenido (WO-2026-00214, Fase 1).
 *
 * Tipos + schemas Zod compartidos por el tracker de cliente y el endpoint del
 * servidor. **Sin lado servidor aquí**: ni `db`, ni `headers()`, ni
 * `server-only`. Este archivo lo importa un componente `'use client'`, así que
 * cualquier import de servidor lo rompería en el bundle del navegador.
 *
 * Qué NO está y por qué: `calculator_*` y `download_resource` no existen porque
 * no hay ninguna superficie en el sitio que los emita hoy. Declarar un evento
 * que nunca ocurre convierte el catálogo en una lista de deseos y hace
 * imposible distinguir "no pasó" de "no está instrumentado".
 *
 * Diseño: docs/superpowers/specs/2026-09-03-seo-contenido-design.md
 */

import { z } from "zod";

// ── Vocabulario cerrado ─────────────────────────────────────────────────────

export const CONTENT_EVENTS = [
  "view",
  "scroll",
  "cta_click",
  "diagnostic_start",
  "diagnostic_complete",
  "lead_created",
  "newsletter_signup",
] as const;

export type ContentEventName = (typeof CONTENT_EVENTS)[number];

/** Eventos que emite el navegador. Los demás solo puede escribirlos el servidor. */
export const CLIENT_EVENTS = [
  "view",
  "scroll",
  "cta_click",
  "diagnostic_start",
] as const satisfies readonly ContentEventName[];

export type ClientEventName = (typeof CLIENT_EVENTS)[number];

const CLIENT_EVENT_SET: ReadonlySet<string> = new Set<string>(CLIENT_EVENTS);

/** `true` si el navegador tiene permitido emitir este evento por `/api/events`. */
export function isClientEvent(event: string): event is ClientEventName {
  return CLIENT_EVENT_SET.has(event);
}

/**
 * Hitos de scroll. 90 y no 100: el pie de página, los créditos y el bloque de
 * "sigue leyendo" hacen que el 100 % casi nunca se alcance aunque el artículo
 * se haya leído entero.
 */
export const SCROLL_DEPTHS = [25, 50, 75, 90] as const;
export type ScrollDepth = (typeof SCROLL_DEPTHS)[number];

/** Profundidad a partir de la cual se considera "leído" en el embudo. */
export const READ_DEPTH: ScrollDepth = 75;

/** Qué CTA se pulsó. Cerrado: un valor libre acabaría con veinte variantes del mismo botón. */
export const CTA_KINDS = [
  "diagnostico",
  "contacto",
  "whatsapp",
  "internal_link",
  "related",
] as const;
export type CtaKind = (typeof CTA_KINDS)[number];

/**
 * Dónde estaba el CTA. Cerrado también, por el mismo motivo: "article_footer"
 * y "articleFooter" contando por separado es un dato roto que nadie nota.
 */
export const CTA_POSITIONS = [
  "header",
  "footer",
  "article_footer",
  "article_body",
  "landing_cta",
  "landing_related",
  "sidebar",
] as const;
export type CtaPosition = (typeof CTA_POSITIONS)[number];

// ── Schemas de `meta`, uno por evento ───────────────────────────────────────

const ScrollMeta = z.object({
  depth: z.union([z.literal(25), z.literal(50), z.literal(75), z.literal(90)]),
});

const CtaClickMeta = z.object({
  cta: z.enum(CTA_KINDS),
  position: z.enum(CTA_POSITIONS),
});

const DiagnosticStartMeta = z.object({
  /** Variante de la entrada al wizard (hoy siempre `default`). */
  variant: z.string().trim().min(1).max(40),
});

const EmptyMeta = z.object({}).strict();

/**
 * `meta` por evento. Acotarlo por tipo —en vez de aceptar un jsonb libre— es lo
 * que impide que un cliente manipulado use `content_events` como almacén
 * arbitrario, y de paso lo que garantiza que `meta->>'depth'` del índice de
 * dedupe signifique siempre lo mismo.
 */
export const EVENT_META_SCHEMAS = {
  view: EmptyMeta,
  scroll: ScrollMeta,
  cta_click: CtaClickMeta,
  diagnostic_start: DiagnosticStartMeta,
  diagnostic_complete: z.object({ lead_id: z.string().uuid() }),
  lead_created: z.object({
    lead_id: z.string().uuid(),
    source: z.enum(["contact_form", "newsletter", "diagnostic"]),
  }),
  newsletter_signup: EmptyMeta,
} as const satisfies Record<ContentEventName, z.ZodTypeAny>;

export type EventMeta<E extends ContentEventName> = z.infer<(typeof EVENT_META_SCHEMAS)[E]>;

// ── Payload del beacon de cliente ───────────────────────────────────────────

/** uuid v4 tal como lo genera `crypto.randomUUID()` en el navegador. */
export const SESSION_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Cuerpo aceptado por `POST /api/events`.
 *
 * `path` ≤ 200 caracteres y sin `?`: el query string no se guarda nunca (es la
 * vía por la que un parámetro ajeno con datos personales acabaría persistido).
 * El endpoint vuelve a normalizar el path por su cuenta — este schema es la
 * primera barrera, no la única.
 */
export const ClientEventPayloadSchema = z
  .object({
    sessionId: z.string().regex(SESSION_ID_RE, "session_id debe ser un uuid v4"),
    path: z
      .string()
      .min(1)
      .max(200)
      .startsWith("/", "path debe ser una ruta del sitio")
      .refine((p) => !p.includes("?") && !p.includes("#"), "path no admite query string ni fragmento"),
    event: z.enum(CLIENT_EVENTS),
    meta: z.unknown().optional(),
  })
  .superRefine((value, ctx) => {
    // El `meta` correcto depende del evento, así que se valida en un segundo
    // paso en vez de con una unión discriminada: los mensajes de error salen
    // apuntando al evento concreto en vez de a las cuatro ramas.
    const schema = EVENT_META_SCHEMAS[value.event];
    const parsed = schema.safeParse(value.meta ?? {});
    if (!parsed.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["meta"],
        message: `meta inválido para el evento '${value.event}'`,
      });
    }
  });

export type ClientEventPayload = z.infer<typeof ClientEventPayloadSchema>;

/**
 * Devuelve el `meta` ya validado y normalizado de un payload de cliente.
 * Se llama después de `ClientEventPayloadSchema`, así que el parseo no puede
 * fallar; el fallback a `{}` existe para no lanzar en un endpoint fail-silent.
 */
export function normalizeClientMeta(payload: ClientEventPayload): Record<string, unknown> {
  const parsed = EVENT_META_SCHEMAS[payload.event].safeParse(payload.meta ?? {});
  return parsed.success ? (parsed.data as Record<string, unknown>) : {};
}
