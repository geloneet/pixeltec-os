import { describe, it, expect, beforeEach, vi } from "vitest";
import { encryptSecret, decryptSecret, MFA_KEY_ERROR } from "./crypto";

/**
 * AES-256-GCM del secreto TOTP (C-PR4): roundtrip, IV único por cifrado,
 * detección de manipulación (tag GCM) y fallo accionable sin la clave.
 */

// 32 bytes deterministas para el test (0x00..0x1f) en base64.
const TEST_KEY = Buffer.from(Array.from({ length: 32 }, (_, i) => i)).toString("base64");
const SECRET = "QELXWLPL4ZQXNGRXMIFDIGIZKQUXYYT5";

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("MFA_ENCRYPTION_KEY", TEST_KEY);
});

describe("encryptSecret / decryptSecret", () => {
  it("roundtrip: descifra exactamente lo cifrado", () => {
    expect(decryptSecret(encryptSecret(SECRET))).toBe(SECRET);
  });

  it("formato iv:tag:ct en base64", () => {
    const parts = encryptSecret(SECRET).split(":");
    expect(parts).toHaveLength(3);
    expect(Buffer.from(parts[0], "base64")).toHaveLength(12); // IV GCM 96 bits
    expect(Buffer.from(parts[1], "base64")).toHaveLength(16); // tag GCM
  });

  it("IV aleatorio: dos cifrados del mismo secreto difieren", () => {
    expect(encryptSecret(SECRET)).not.toBe(encryptSecret(SECRET));
  });

  it("ciphertext manipulado → lanza (tag GCM no valida)", () => {
    const [iv, tag, ct] = encryptSecret(SECRET).split(":");
    const bytes = Buffer.from(ct, "base64");
    bytes[0] ^= 0xff;
    const tampered = `${iv}:${tag}:${bytes.toString("base64")}`;
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("formato inválido → lanza con mensaje claro", () => {
    expect(() => decryptSecret("no-es-un-secreto")).toThrow(/iv:tag:ct/);
  });

  it("sin MFA_ENCRYPTION_KEY → lanza con mensaje accionable, al usar (no al importar)", () => {
    vi.stubEnv("MFA_ENCRYPTION_KEY", "");
    expect(() => encryptSecret(SECRET)).toThrow(new RegExp(MFA_KEY_ERROR));
    expect(() => encryptSecret(SECRET)).toThrow(/openssl rand -base64 32/);
  });

  it("clave de longitud incorrecta → lanza indicando los bytes", () => {
    vi.stubEnv("MFA_ENCRYPTION_KEY", Buffer.from("corta").toString("base64"));
    expect(() => encryptSecret(SECRET)).toThrow(/32 bytes/);
  });
});
