import { describe, expect, test } from "vitest";
import { canSignContract } from "./contract-status";

describe("canSignContract", () => {
  test("permite firmar desde borrador", () => {
    expect(canSignContract("borrador")).toEqual({ ok: true });
  });

  test("permite firmar desde en_revision", () => {
    expect(canSignContract("en_revision")).toEqual({ ok: true });
  });

  test("rechaza firmar un contrato ya firmado", () => {
    expect(canSignContract("firmado")).toEqual({ ok: false, reason: "already_signed" });
  });

  test("rechaza firmar un contrato cancelado", () => {
    expect(canSignContract("cancelado")).toEqual({ ok: false, reason: "cancelled" });
  });

  test("rechaza firmar un contrato vencido", () => {
    expect(canSignContract("vencido")).toEqual({ ok: false, reason: "expired" });
  });
});
