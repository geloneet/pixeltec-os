import { describe, expect, it } from "vitest";
import { isSystemSlug, resolveSaveTransition, SCHEDULE_ERROR } from "./transitions";

const NOW = new Date("2026-08-25T12:00:00.000Z");
const BASE = { status: "draft", publishedAt: null, scheduledAt: null };

describe("resolveSaveTransition — paridad Encino (saveBlogPostAction)", () => {
  it("autosave: no cambia estado ni fechas", () => {
    const r = resolveSaveTransition({ status: "approved", publishedAt: null, scheduledAt: new Date("2027-01-01") }, "autosave", undefined, NOW);
    expect(r).toEqual({ ok: true, next: { status: "approved", publishedAt: null, scheduledAt: new Date("2027-01-01") } });
  });

  it("draft: cancela programación y conserva publishedAt", () => {
    const existing = { status: "scheduled", publishedAt: new Date("2026-01-01"), scheduledAt: new Date("2027-01-01") };
    const r = resolveSaveTransition(existing, "draft", undefined, NOW);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.next.status).toBe("draft");
      expect(r.next.scheduledAt).toBeNull();
      expect(r.next.publishedAt).toEqual(new Date("2026-01-01"));
    }
  });

  it("publish: primera vez usa `now`; re-publicar conserva la fecha original", () => {
    const first = resolveSaveTransition(BASE, "publish", undefined, NOW);
    expect(first.ok && first.next.publishedAt).toEqual(NOW);

    const republish = resolveSaveTransition({ status: "published", publishedAt: new Date("2020-01-01"), scheduledAt: null }, "publish", undefined, NOW);
    expect(republish.ok && republish.next.publishedAt).toEqual(new Date("2020-01-01"));
  });

  it("publish: cancela cualquier programación pendiente", () => {
    const r = resolveSaveTransition({ status: "scheduled", publishedAt: null, scheduledAt: new Date("2027-01-01") }, "publish", undefined, NOW);
    expect(r.ok && r.next.scheduledAt).toBeNull();
  });

  it("schedule: exige fecha futura parseable, si no rechaza con el mensaje exacto", () => {
    expect(resolveSaveTransition(BASE, "schedule", undefined, NOW)).toEqual({ ok: false, error: SCHEDULE_ERROR });
    expect(resolveSaveTransition(BASE, "schedule", "fecha-invalida", NOW)).toEqual({ ok: false, error: SCHEDULE_ERROR });
    expect(resolveSaveTransition(BASE, "schedule", "2020-01-01T00:00:00.000Z", NOW)).toEqual({ ok: false, error: SCHEDULE_ERROR });
  });

  it("schedule: fecha futura válida → status scheduled + scheduledAt, conserva publishedAt", () => {
    const existing = { status: "approved", publishedAt: null, scheduledAt: null };
    const r = resolveSaveTransition(existing, "schedule", "2027-06-01T10:00:00.000Z", NOW);
    expect(r).toEqual({ ok: true, next: { status: "scheduled", publishedAt: null, scheduledAt: new Date("2027-06-01T10:00:00.000Z") } });
  });
});

describe("isSystemSlug — regenerar slug hasta que el usuario lo toque", () => {
  it("reconoce slugs de sistema", () => {
    expect(isSystemSlug("borrador-1a2b3c4d")).toBe(true);
    expect(isSystemSlug("entrada-deadbeef")).toBe(true);
  });
  it("no confunde un slug real con uno de sistema", () => {
    expect(isSystemSlug("como-migrar-a-postgres")).toBe(false);
    expect(isSystemSlug("borrador-de-mi-estrategia")).toBe(false);
  });
});
