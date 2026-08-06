import { describe, it, expect } from "vitest";
import { generate } from "otplib";
import {
  TOTP_PERIOD_S,
  generateRecoveryCodes,
  hashRecoveryCode,
  isTotpFormat,
  normalizeRecoveryCode,
  verifyTotp,
} from "./totp";

/**
 * Verificación TOTP determinista (C-PR4): en vez de mockear Date, el epoch
 * (segundos unix) se inyecta tanto al generar (otplib v13 `generate`) como
 * a `verifyTotp` — mismos vectores en cada corrida.
 */

const SECRET = "QELXWLPL4ZQXNGRXMIFDIGIZKQUXYYT5";
const EPOCH = 1_754_300_000; // fijo — dentro de un paso de 30s

describe("verifyTotp — determinista con epoch inyectado", () => {
  it("token del paso actual → ok con su timeStep", async () => {
    const token = await generate({ secret: SECRET, epoch: EPOCH });
    const verdict = await verifyTotp(SECRET, token, null, EPOCH);
    expect(verdict.ok).toBe(true);
    if (verdict.ok) expect(verdict.step).toBe(Math.floor(EPOCH / TOTP_PERIOD_S));
  });

  it("ventana 1: el token del paso ANTERIOR todavía vale", async () => {
    const token = await generate({ secret: SECRET, epoch: EPOCH - TOTP_PERIOD_S });
    const verdict = await verifyTotp(SECRET, token, null, EPOCH);
    expect(verdict.ok).toBe(true);
  });

  it("fuera de ventana (2 pasos atrás) → rechazado", async () => {
    const token = await generate({ secret: SECRET, epoch: EPOCH - 3 * TOTP_PERIOD_S });
    const verdict = await verifyTotp(SECRET, token, null, EPOCH);
    expect(verdict.ok).toBe(false);
  });

  it("token basura → rechazado", async () => {
    const verdict = await verifyTotp(SECRET, "000000", null, EPOCH);
    // Colisión teórica 1 en 10^6 — con secreto y epoch fijos es determinista.
    expect(verdict.ok).toBe(false);
  });

  it("anti-replay: el mismo paso ya usado → rechazado aunque el token valide", async () => {
    const token = await generate({ secret: SECRET, epoch: EPOCH });
    const step = Math.floor(EPOCH / TOTP_PERIOD_S);
    const verdict = await verifyTotp(SECRET, token, step, EPOCH);
    expect(verdict.ok).toBe(false);
  });

  it("anti-replay: un paso más viejo que el último usado → rechazado", async () => {
    const token = await generate({ secret: SECRET, epoch: EPOCH - TOTP_PERIOD_S });
    const lastUsed = Math.floor(EPOCH / TOTP_PERIOD_S); // ya se usó el actual
    const verdict = await verifyTotp(SECRET, token, lastUsed, EPOCH);
    expect(verdict.ok).toBe(false);
  });

  it("paso siguiente al último usado → aceptado (flujo normal)", async () => {
    const token = await generate({ secret: SECRET, epoch: EPOCH });
    const lastUsed = Math.floor(EPOCH / TOTP_PERIOD_S) - 1;
    const verdict = await verifyTotp(SECRET, token, lastUsed, EPOCH);
    expect(verdict.ok).toBe(true);
  });
});

describe("formato y códigos de recuperación", () => {
  it("isTotpFormat: 6 dígitos sí; recovery/otros no", () => {
    expect(isTotpFormat("123456")).toBe(true);
    expect(isTotpFormat(" 123456 ")).toBe(true);
    expect(isTotpFormat("12345")).toBe(false);
    expect(isTotpFormat("ABCDE23456")).toBe(false);
  });

  it("normaliza mayúsculas, espacios y guiones", () => {
    expect(normalizeRecoveryCode(" ab2c-d3ef 45 ")).toBe("AB2CD3EF45");
  });

  it("hash estable ante variantes de formato del mismo código", () => {
    expect(hashRecoveryCode("AB2CD3EF45")).toBe(hashRecoveryCode("ab2c-d3ef-45"));
    expect(hashRecoveryCode("AB2CD3EF45")).not.toBe(hashRecoveryCode("AB2CD3EF46"));
    expect(hashRecoveryCode("AB2CD3EF45")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("genera 10 códigos únicos de 10 chars base32, nunca formato TOTP", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const code of codes) {
      expect(code).toMatch(/^[A-Z2-7]{10}$/);
      expect(isTotpFormat(code)).toBe(false);
    }
  });
});
