import { describe, expect, test } from "vitest";
import { isTokenRevoked } from "./revocation";

/**
 * Corte de sesiones al cambiar contraseña (estrategia JWT: no hay tabla de
 * sesiones que borrar). `isTokenRevoked` es pura para poder fijar aquí la
 * frontera exacta sin base de datos.
 */

const EMITIDO = 1_770_000_000; // segundos epoch, valor sintético
const corteEn = (segundos: number) => new Date(segundos * 1000);

describe("isTokenRevoked", () => {
  test("sin corte registrado no revoca nada (comportamiento previo)", () => {
    expect(isTokenRevoked(EMITIDO, null)).toBe(false);
  });

  test("token emitido ANTES del corte queda revocado", () => {
    expect(isTokenRevoked(EMITIDO, corteEn(EMITIDO + 60))).toBe(true);
  });

  test("token emitido DESPUÉS del corte sigue siendo válido", () => {
    expect(isTokenRevoked(EMITIDO, corteEn(EMITIDO - 60))).toBe(false);
  });

  test("token emitido en el mismo segundo del corte sobrevive", () => {
    // Quien cambia su contraseña no debe expulsarse a sí mismo por el redondeo
    // de `iat` (segundos) frente al timestamp de Postgres (milisegundos).
    expect(isTokenRevoked(EMITIDO, corteEn(EMITIDO))).toBe(false);
    expect(isTokenRevoked(EMITIDO, new Date(EMITIDO * 1000 + 999))).toBe(false);
  });

  test("con corte activo, un token sin `iat` se rechaza (fail-closed)", () => {
    expect(isTokenRevoked(undefined, corteEn(EMITIDO))).toBe(true);
  });

  test("sin corte, un token sin `iat` no se rechaza", () => {
    expect(isTokenRevoked(undefined, null)).toBe(false);
  });
});
