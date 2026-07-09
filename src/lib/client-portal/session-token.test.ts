import { describe, expect, test } from "vitest";
import { signPortalSessionToken, verifyPortalSessionToken } from "./session-token";

const SECRET = "test-secret";
const NOW = 1_700_000_000_000;

describe("signPortalSessionToken / verifyPortalSessionToken", () => {
  test("round-trips a valid token", () => {
    const token = signPortalSessionToken({ clientId: "client-1", exp: NOW + 1000 }, SECRET);
    expect(verifyPortalSessionToken(token, SECRET, NOW)).toEqual({ clientId: "client-1", exp: NOW + 1000 });
  });

  test("rejects an expired token", () => {
    const token = signPortalSessionToken({ clientId: "client-1", exp: NOW - 1000 }, SECRET);
    expect(verifyPortalSessionToken(token, SECRET, NOW)).toBeNull();
  });

  test("rejects a token signed with a different secret", () => {
    const token = signPortalSessionToken({ clientId: "client-1", exp: NOW + 1000 }, SECRET);
    expect(verifyPortalSessionToken(token, "wrong-secret", NOW)).toBeNull();
  });

  test("rejects a tampered payload", () => {
    const token = signPortalSessionToken({ clientId: "client-1", exp: NOW + 1000 }, SECRET);
    const [, signature] = token.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({ clientId: "client-2", exp: NOW + 1000 }),
      "utf-8",
    ).toString("base64url");
    expect(verifyPortalSessionToken(`${tamperedPayload}.${signature}`, SECRET, NOW)).toBeNull();
  });

  test("rejects a malformed token", () => {
    expect(verifyPortalSessionToken("not-a-valid-token", SECRET, NOW)).toBeNull();
  });
});
