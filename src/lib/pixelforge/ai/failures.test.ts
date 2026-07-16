import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { describe, expect, it } from "vitest";
import { PixelforgeRunError, classifyError, classifyStopReason } from "./failures";

describe("classifyStopReason", () => {
  it('mapea "refusal" a failureKind refusal', () => {
    expect(classifyStopReason("refusal")).toBe("refusal");
  });

  it('mapea "max_tokens" a failureKind max_tokens', () => {
    expect(classifyStopReason("max_tokens")).toBe("max_tokens");
  });

  it('devuelve null para "end_turn" (no es un fallo)', () => {
    expect(classifyStopReason("end_turn")).toBeNull();
  });

  it("devuelve null para null", () => {
    expect(classifyStopReason(null)).toBeNull();
  });

  it("devuelve null para cualquier otro stop_reason desconocido", () => {
    expect(classifyStopReason("tool_use")).toBeNull();
  });
});

describe("classifyError", () => {
  it("mapea ZodError a domain_validation", () => {
    const schema = z.object({ a: z.string() });
    const result = schema.safeParse({ a: 1 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(classifyError(result.error)).toBe("domain_validation");
    }
  });

  it("mapea Anthropic.APIConnectionTimeoutError (instancia real) a timeout", () => {
    const err = new Anthropic.APIConnectionTimeoutError();
    expect(classifyError(err)).toBe("timeout");
  });

  it('mapea un error con name "AbortError" (duck-typing, no instanceof) a timeout', () => {
    const err = { name: "AbortError", message: "The operation was aborted." };
    expect(classifyError(err)).toBe("timeout");
  });

  it('mapea un shape con name "APIConnectionTimeoutError" (duck-typing) a timeout', () => {
    const err = { name: "APIConnectionTimeoutError", message: "Request timed out." };
    expect(classifyError(err)).toBe("timeout");
  });

  it("mapea Anthropic.APIError con status 400 y mensaje de schema/grammar a schema_too_complex", () => {
    const err = new Anthropic.APIError(400, undefined, "Invalid output_config.format: schema too complex", undefined);
    expect(classifyError(err)).toBe("schema_too_complex");
  });

  it("mapea un APIError 400 duck-typed con mensaje de grammar a schema_too_complex", () => {
    const err = { status: 400, message: "grammar compilation failed", name: "BadRequestError" };
    expect(classifyError(err)).toBe("schema_too_complex");
  });

  it("mapea Anthropic.APIError con status 500 a provider_error", () => {
    const err = new Anthropic.APIError(500, undefined, "Internal server error", undefined);
    expect(classifyError(err)).toBe("provider_error");
  });

  it("mapea Anthropic.APIError con status 400 pero SIN mensaje de schema a provider_error", () => {
    const err = new Anthropic.APIError(400, undefined, "Invalid API key", undefined);
    expect(classifyError(err)).toBe("provider_error");
  });

  it("mapea un error desconocido (Error genérico) a provider_error", () => {
    expect(classifyError(new Error("algo raro pasó"))).toBe("provider_error");
  });

  it("mapea un valor no-objeto (string, undefined) a provider_error", () => {
    expect(classifyError("boom")).toBe("provider_error");
    expect(classifyError(undefined)).toBe("provider_error");
  });
});

describe("PixelforgeRunError", () => {
  it("expone kind y message", () => {
    const err = new PixelforgeRunError("refusal", "El modelo rechazó la operación.");
    expect(err).toBeInstanceOf(Error);
    expect(err.kind).toBe("refusal");
    expect(err.message).toBe("El modelo rechazó la operación.");
  });

  it("retryable es true SOLO para domain_validation", () => {
    expect(new PixelforgeRunError("domain_validation", "x").retryable).toBe(true);
    expect(new PixelforgeRunError("refusal", "x").retryable).toBe(false);
    expect(new PixelforgeRunError("max_tokens", "x").retryable).toBe(false);
    expect(new PixelforgeRunError("schema_too_complex", "x").retryable).toBe(false);
    expect(new PixelforgeRunError("provider_error", "x").retryable).toBe(false);
    expect(new PixelforgeRunError("timeout", "x").retryable).toBe(false);
  });
});
