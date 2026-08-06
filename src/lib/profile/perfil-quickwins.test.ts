import { describe, expect, test } from "vitest";
import { UpdateProfileSchema } from "./schemas";
import { matchesMagicBytes } from "./avatar-image";

/**
 * C-PR1 — quick wins de «Perfil y seguridad»:
 *  - `bio` sale del schema (columna muerta hasta el DROP en Gate B8);
 *  - entra `jobTitle` («Cargo o puesto», máx 100, opcional);
 *  - el avatar valida los magic bytes del contenido real, no solo el
 *    `file.type` declarado por el cliente.
 */

describe("UpdateProfileSchema (C-PR1)", () => {
  test("acepta jobTitle opcional y lo conserva", () => {
    const parsed = UpdateProfileSchema.safeParse({
      displayName: "Miguel Robles",
      jobTitle: "Dirección",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.jobTitle).toBe("Dirección");
    }
  });

  test("jobTitle puede omitirse (displayName sigue siendo el único obligatorio)", () => {
    const parsed = UpdateProfileSchema.safeParse({ displayName: "Miguel" });
    expect(parsed.success).toBe(true);
  });

  test("jobTitle de más de 100 caracteres se rechaza", () => {
    const parsed = UpdateProfileSchema.safeParse({
      displayName: "Miguel",
      jobTitle: "x".repeat(101),
    });
    expect(parsed.success).toBe(false);
  });

  test("bio ya no forma parte del perfil: se descarta del resultado", () => {
    const parsed = UpdateProfileSchema.safeParse({
      displayName: "Miguel",
      bio: "esto ya no existe",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect("bio" in parsed.data).toBe(false);
    }
  });

  test("displayName vacío se sigue rechazando", () => {
    const parsed = UpdateProfileSchema.safeParse({ displayName: "" });
    expect(parsed.success).toBe(false);
  });
});

describe("matchesMagicBytes (C-PR1)", () => {
  const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const WEBP = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
  ]);

  test("acepta cada formato cuando el contenido coincide con lo declarado", () => {
    expect(matchesMagicBytes(JPEG, "image/jpeg")).toBe(true);
    expect(matchesMagicBytes(PNG, "image/png")).toBe(true);
    expect(matchesMagicBytes(WEBP, "image/webp")).toBe(true);
  });

  test("rechaza cuando el contenido no coincide con el tipo declarado", () => {
    expect(matchesMagicBytes(JPEG, "image/png")).toBe(false);
    expect(matchesMagicBytes(PNG, "image/jpeg")).toBe(false);
    expect(matchesMagicBytes(PNG, "image/webp")).toBe(false);
    expect(matchesMagicBytes(WEBP, "image/png")).toBe(false);
  });

  test("rechaza RIFF que no es WebP (p. ej. un WAV)", () => {
    const wav = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
    ]);
    expect(matchesMagicBytes(wav, "image/webp")).toBe(false);
  });

  test("rechaza buffers demasiado cortos o arbitrarios", () => {
    expect(matchesMagicBytes(new Uint8Array([]), "image/png")).toBe(false);
    expect(matchesMagicBytes(new Uint8Array([0xff, 0xd8]), "image/jpeg")).toBe(false);
    expect(matchesMagicBytes(new Uint8Array([1, 2, 3, 4]), "image/png")).toBe(false);
  });
});
