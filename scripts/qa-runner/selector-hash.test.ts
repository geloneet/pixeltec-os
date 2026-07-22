import { describe, expect, it } from "vitest";
import { hashSelector } from "./selector-hash";

describe("hashSelector", () => {
  it("es determinista: la misma entrada produce siempre el mismo hash", () => {
    expect(hashSelector("#hero > h1")).toBe(hashSelector("#hero > h1"));
  });

  it("entradas distintas producen hashes distintos (sin colisión en casos triviales)", () => {
    expect(hashSelector("#hero > h1")).not.toBe(hashSelector("#hero > h2"));
  });

  it("siempre devuelve 8 caracteres hex", () => {
    expect(hashSelector("")).toMatch(/^[0-9a-f]{8}$/);
    expect(hashSelector("x".repeat(500))).toMatch(/^[0-9a-f]{8}$/);
  });
});
