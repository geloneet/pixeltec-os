import { describe, expect, test } from "vitest";
import {
  ClientEventPayloadSchema,
  CLIENT_EVENTS,
  CONTENT_EVENTS,
  isClientEvent,
  normalizeClientMeta,
} from "./events";

const SESSION = "3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";

function payload(over: Record<string, unknown> = {}) {
  return { sessionId: SESSION, path: "/blog/hola", event: "view", ...over };
}

describe("catálogo de eventos", () => {
  test("todo evento de cliente pertenece al catálogo completo", () => {
    for (const e of CLIENT_EVENTS) expect(CONTENT_EVENTS).toContain(e);
  });

  test("los eventos de servidor NO son emitibles desde el navegador", () => {
    expect(isClientEvent("lead_created")).toBe(false);
    expect(isClientEvent("diagnostic_complete")).toBe(false);
    expect(isClientEvent("newsletter_signup")).toBe(false);
    expect(isClientEvent("scroll")).toBe(true);
  });
});

describe("ClientEventPayloadSchema", () => {
  test("payload mínimo válido", () => {
    expect(ClientEventPayloadSchema.safeParse(payload()).success).toBe(true);
  });

  test("session_id que no es uuid v4 → rechazado", () => {
    expect(ClientEventPayloadSchema.safeParse(payload({ sessionId: "abc" })).success).toBe(false);
    // uuid v1: versión equivocada, también se rechaza.
    expect(
      ClientEventPayloadSchema.safeParse(payload({ sessionId: "3f1b2c4d-5e6f-1a7b-8c9d-0e1f2a3b4c5d" })).success
    ).toBe(false);
  });

  test("path con query string → rechazado (frontera de privacidad)", () => {
    expect(ClientEventPayloadSchema.safeParse(payload({ path: "/blog/x?utm_source=y" })).success).toBe(false);
    expect(ClientEventPayloadSchema.safeParse(payload({ path: "/blog/x#seccion" })).success).toBe(false);
  });

  test("path que no empieza por / o excede 200 → rechazado", () => {
    expect(ClientEventPayloadSchema.safeParse(payload({ path: "blog/x" })).success).toBe(false);
    expect(ClientEventPayloadSchema.safeParse(payload({ path: `/${"a".repeat(210)}` })).success).toBe(false);
  });

  test("evento fuera del catálogo de cliente → rechazado", () => {
    expect(ClientEventPayloadSchema.safeParse(payload({ event: "lead_created" })).success).toBe(false);
    expect(ClientEventPayloadSchema.safeParse(payload({ event: "download_resource" })).success).toBe(false);
  });

  test("scroll exige un hito del catálogo", () => {
    expect(ClientEventPayloadSchema.safeParse(payload({ event: "scroll", meta: { depth: 75 } })).success).toBe(true);
    expect(ClientEventPayloadSchema.safeParse(payload({ event: "scroll", meta: { depth: 33 } })).success).toBe(false);
    expect(ClientEventPayloadSchema.safeParse(payload({ event: "scroll" })).success).toBe(false);
  });

  test("cta_click exige cta y position del vocabulario cerrado", () => {
    const ok = payload({ event: "cta_click", meta: { cta: "diagnostico", position: "article_footer" } });
    expect(ClientEventPayloadSchema.safeParse(ok).success).toBe(true);

    const badCta = payload({ event: "cta_click", meta: { cta: "otro", position: "article_footer" } });
    expect(ClientEventPayloadSchema.safeParse(badCta).success).toBe(false);

    const badPos = payload({ event: "cta_click", meta: { cta: "contacto", position: "articleFooter" } });
    expect(ClientEventPayloadSchema.safeParse(badPos).success).toBe(false);
  });

  test("meta con claves extra en un evento sin meta → rechazado (no es almacén libre)", () => {
    const injected = payload({ event: "view", meta: { email: "alguien@ejemplo.mx" } });
    expect(ClientEventPayloadSchema.safeParse(injected).success).toBe(false);
  });
});

describe("normalizeClientMeta", () => {
  test("devuelve el meta parseado del evento", () => {
    const parsed = ClientEventPayloadSchema.parse(payload({ event: "scroll", meta: { depth: 50 } }));
    expect(normalizeClientMeta(parsed)).toEqual({ depth: 50 });
  });

  test("evento sin meta devuelve objeto vacío, no undefined", () => {
    const parsed = ClientEventPayloadSchema.parse(payload());
    expect(normalizeClientMeta(parsed)).toEqual({});
  });
});
