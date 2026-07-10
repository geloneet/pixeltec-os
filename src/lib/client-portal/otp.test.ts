import { describe, expect, test } from "vitest";
import { generateAccessCode, hashAccessCode, accessCodeMatches } from "./otp";

describe("generateAccessCode", () => {
  test("returns a 6-digit numeric string", () => {
    for (let i = 0; i < 20; i++) {
      expect(generateAccessCode()).toMatch(/^\d{6}$/);
    }
  });
});

describe("hashAccessCode", () => {
  test("is deterministic for the same code and secret", () => {
    expect(hashAccessCode("123456", "secret")).toBe(hashAccessCode("123456", "secret"));
  });

  test("differs for different codes", () => {
    expect(hashAccessCode("123456", "secret")).not.toBe(hashAccessCode("654321", "secret"));
  });

  test("differs for different secrets", () => {
    expect(hashAccessCode("123456", "secret-a")).not.toBe(hashAccessCode("123456", "secret-b"));
  });
});

describe("accessCodeMatches", () => {
  test("returns true for the correct code", () => {
    const hash = hashAccessCode("123456", "secret");
    expect(accessCodeMatches(hash, "123456", "secret")).toBe(true);
  });

  test("returns false for an incorrect code", () => {
    const hash = hashAccessCode("123456", "secret");
    expect(accessCodeMatches(hash, "654321", "secret")).toBe(false);
  });

  test("returns false for a malformed stored hash", () => {
    expect(accessCodeMatches("not-a-hex-hash", "123456", "secret")).toBe(false);
  });
});
