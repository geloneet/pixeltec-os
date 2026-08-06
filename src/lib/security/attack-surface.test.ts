import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CreateNotificationInputSchema } from "@/lib/notifications/schemas";

/**
 * Ataques de la auditoría 2026-08-06 que no viven en la capa de datos.
 *
 * Cada caso reproduce el vector concreto: si alguien revierte el fix, el test
 * falla describiendo el ataque, no el detalle de implementación.
 */

const SRC = resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(resolve(SRC, rel), "utf8");

describe("open redirect en /login", () => {
  const login = read("app/login/page.tsx");

  test("el destino pasa por el helper compartido, no por un predicado propio", () => {
    // `window.location.assign(param)` crudo: abrir /login?redirect=https://…
    // con sesión activa sacaba al visitante del sitio SIN interacción.
    expect(login).not.toMatch(/window\.location\.assign\(\s*redirectParam/);
    expect(login).toContain("safeInternalPath");
    // Un predicado inline aquí volvería a divergir del de `href`.
    expect(login).not.toMatch(/startsWith\('\/\/'\)/);
  });
});

describe("notificaciones — href y superficie RPC", () => {
  test("ATAQUE — href externo o javascript: se rechaza", () => {
    const base = { userId: "u", type: "info" as const, title: "t", body: "b", source: "s" };
    expect(CreateNotificationInputSchema.safeParse({ ...base, href: "/cobros" }).success).toBe(true);
    expect(
      CreateNotificationInputSchema.safeParse({ ...base, href: "javascript:alert(1)" }).success
    ).toBe(false);
    expect(
      CreateNotificationInputSchema.safeParse({ ...base, href: "https://evil.example" }).success
    ).toBe(false);
    expect(CreateNotificationInputSchema.safeParse({ ...base, href: "//evil.example" }).success).toBe(
      false
    );
  });

  test("createNotification NO es una server action", () => {
    // Vivía en actions.ts: cualquiera podía insertar notificaciones para
    // cualquier userId sin sesión. Ahora es server-only por import directo.
    const create = read("lib/notifications/create.ts");
    expect(create).toContain("export async function createNotification");
    expect(create).not.toMatch(/^\s*["']use server["']/m);
    expect(read("lib/notifications/actions.ts")).not.toContain(
      "export async function createNotification"
    );
  });
});

describe("relay de correo abierto", () => {
  test("las cinco actions sin sesión ya no existen", () => {
    const actions = read("app/actions.ts");
    for (const fn of [
      "sendNewClientEmailAction",
      "sendPaymentEmailAction",
      "sendTaskEmailAction",
      "sendTicketEmailAction",
      "sendTestEmailAction",
    ]) {
      expect(actions).not.toContain(`export async function ${fn}`);
    }
  });
});

describe("token OAuth de Meta", () => {
  const social = read("lib/growth/actions/social-accounts.ts");

  test("ATAQUE — getAccessToken(accountId, uid) ya no existe", () => {
    // Tomaba la identidad de un PARÁMETRO en un archivo 'use server': devolvía
    // el access token de Meta en claro de la cuenta de cualquier uid.
    expect(social).not.toContain("export async function getAccessToken");
  });

  test("upsertSocialAccount deriva la identidad de la sesión, no del payload", () => {
    const start = social.indexOf("export async function upsertSocialAccount");
    const body = social.slice(start, social.indexOf("export async function", start + 1));
    expect(body).toContain("getSessionUserId()");
    expect(body).not.toMatch(/resolveOwnerId\(\s*data\.uid\s*\)/);
  });
});
