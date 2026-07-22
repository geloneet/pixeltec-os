import crypto from "node:crypto";
import { describe, expect, test } from "vitest";
import { signQaPreviewToken, verifyQaPreviewToken, type QaPreviewTokenPayload } from "./preview-token";

const SECRET = "test-secret-pfqa";
// Epoch SEGUNDOS (el payload real usa segundos, no ms — a diferencia de
// `client-portal/session-token.ts`).
const NOW = 1_753_000_000;

const BASE_PAYLOAD: QaPreviewTokenPayload = {
  qaRunId: "qa-run-1",
  projectId: "project-1",
  pageVersionId: "version-1",
  ownerId: "owner-1",
  exp: NOW + 600,
};

describe("signQaPreviewToken / verifyQaPreviewToken", () => {
  test("hace roundtrip de un token válido", () => {
    const token = signQaPreviewToken(BASE_PAYLOAD, SECRET);
    expect(verifyQaPreviewToken(token, SECRET, NOW)).toEqual(BASE_PAYLOAD);
  });

  test("rechaza cuando exp == now (expirado en el límite)", () => {
    const token = signQaPreviewToken({ ...BASE_PAYLOAD, exp: NOW }, SECRET);
    expect(verifyQaPreviewToken(token, SECRET, NOW)).toBeNull();
  });

  test("acepta cuando exp == now + 1 (justo antes de expirar)", () => {
    const token = signQaPreviewToken({ ...BASE_PAYLOAD, exp: NOW + 1 }, SECRET);
    expect(verifyQaPreviewToken(token, SECRET, NOW)).toEqual({ ...BASE_PAYLOAD, exp: NOW + 1 });
  });

  test("rechaza si la firma se altera un solo carácter", () => {
    const token = signQaPreviewToken(BASE_PAYLOAD, SECRET);
    const [payloadB64, signature] = token.split(".");
    const lastChar = signature.at(-1);
    const swapped = lastChar === "A" ? "B" : "A";
    const tampered = `${payloadB64}.${signature.slice(0, -1)}${swapped}`;
    expect(verifyQaPreviewToken(tampered, SECRET, NOW)).toBeNull();
  });

  test("rechaza si el payload se altera (firma ya no corresponde)", () => {
    const token = signQaPreviewToken(BASE_PAYLOAD, SECRET);
    const [, signature] = token.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({ ...BASE_PAYLOAD, ownerId: "owner-atacante" }),
      "utf-8"
    ).toString("base64url");
    expect(verifyQaPreviewToken(`${tamperedPayload}.${signature}`, SECRET, NOW)).toBeNull();
  });

  test("rechaza si se firmó con un secreto distinto", () => {
    const token = signQaPreviewToken(BASE_PAYLOAD, SECRET);
    expect(verifyQaPreviewToken(token, "otro-secreto", NOW)).toBeNull();
  });

  test.each([
    ["cadena vacía", ""],
    ["formato basura de 3 partes", "a.b.c"],
    ["sin separador", "solountoken"],
    ["base64 corrupto en el payload", "***no-es-base64***.firmaquesea"],
  ])("rechaza formato basura: %s", (_label, garbage) => {
    expect(verifyQaPreviewToken(garbage, SECRET, NOW)).toBeNull();
  });

  test("rechaza un payload cuyo JSON no parsea", () => {
    const brokenPayloadB64 = Buffer.from("{no-es-json", "utf-8").toString("base64url");
    const signature = crypto.createHmac("sha256", SECRET).update(brokenPayloadB64).digest("base64url");
    expect(verifyQaPreviewToken(`${brokenPayloadB64}.${signature}`, SECRET, NOW)).toBeNull();
  });

  test("rechaza un payload con shape incompleto (falta ownerId)", () => {
    const { ownerId: _omit, ...incomplete } = BASE_PAYLOAD;
    const payloadB64 = Buffer.from(JSON.stringify(incomplete), "utf-8").toString("base64url");
    const signature = crypto.createHmac("sha256", SECRET).update(payloadB64).digest("base64url");
    expect(verifyQaPreviewToken(`${payloadB64}.${signature}`, SECRET, NOW)).toBeNull();
  });

  test("rechaza un payload con tipos incorrectos (exp como string)", () => {
    const payloadB64 = Buffer.from(
      JSON.stringify({ ...BASE_PAYLOAD, exp: String(BASE_PAYLOAD.exp) }),
      "utf-8"
    ).toString("base64url");
    const signature = crypto.createHmac("sha256", SECRET).update(payloadB64).digest("base64url");
    expect(verifyQaPreviewToken(`${payloadB64}.${signature}`, SECRET, NOW)).toBeNull();
  });

  test("rechaza cuando el payload parsea a `null`", () => {
    const payloadB64 = Buffer.from("null", "utf-8").toString("base64url");
    const signature = crypto.createHmac("sha256", SECRET).update(payloadB64).digest("base64url");
    expect(verifyQaPreviewToken(`${payloadB64}.${signature}`, SECRET, NOW)).toBeNull();
  });

  test("el orden de claves del payload de entrada no afecta la firma (orden canónico)", () => {
    // Mismo contenido, orden de inserción distinto en el objeto literal —
    // `signQaPreviewToken` debe firmar sobre el mismo JSON canónico.
    const reordered: QaPreviewTokenPayload = {
      exp: BASE_PAYLOAD.exp,
      ownerId: BASE_PAYLOAD.ownerId,
      pageVersionId: BASE_PAYLOAD.pageVersionId,
      projectId: BASE_PAYLOAD.projectId,
      qaRunId: BASE_PAYLOAD.qaRunId,
    };
    expect(signQaPreviewToken(reordered, SECRET)).toBe(signQaPreviewToken(BASE_PAYLOAD, SECRET));
  });
});
