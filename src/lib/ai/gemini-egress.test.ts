import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Gate WO-2026-00222 — política de salida hacia Gemini.
 *
 * Mismo criterio que ai-egress.test.ts (Anthropic): un bloqueo debe impedir
 * que se construya el payload y que se haga el fetch. Cero red real: `fetch`
 * está mockeado y se comprueba que reciba cero llamadas cuando la política
 * bloquea, y que el cuerpo de error nunca llegue al `AiProviderError`.
 */

const MODEL = "gemini-2.0-flash-lite";

function setAllowlistEnv(models: string[]) {
  process.env.EGRESS_AI_MODE = "allowlist";
  process.env.EGRESS_AI_TARGET_ALLOWLIST = models.map((m) => `google:${m}`).join(",");
  process.env.EGRESS_AI_ALLOW_INPUT_OUTSIDE_PRODUCTION = "true";
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  process.env = { ...ORIGINAL_ENV };
  process.env.GEMINI_API_KEY = "test-key-sintetica";
  setAllowlistEnv([MODEL]);
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

describe("geminiGenerateText — política antes que payload", () => {
  it("modelo fuera de la allowlist: bloquea sin construir params ni llamar fetch", async () => {
    const { geminiGenerateText } = await import("./gemini-egress");
    const buildParams = vi.fn(() => ({ prompt: "no debería construirse" }));
    const fetchImpl = vi.fn();

    await expect(
      geminiGenerateText({ operation: "generate_text", model: "modelo-no-autorizado", buildParams, fetchImpl }),
    ).rejects.toThrow();

    expect(buildParams).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("allowlist vacía: bloquea (fail-closed)", async () => {
    process.env.EGRESS_AI_TARGET_ALLOWLIST = "";
    const { geminiGenerateText } = await import("./gemini-egress");
    const buildParams = vi.fn(() => ({ prompt: "x" }));
    const fetchImpl = vi.fn();

    await expect(
      geminiGenerateText({ operation: "generate_text", model: MODEL, buildParams, fetchImpl }),
    ).rejects.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sin GEMINI_API_KEY: ai_not_configured, sin llamar fetch", async () => {
    delete process.env.GEMINI_API_KEY;
    const { geminiGenerateText, AiProviderError } = await import("./gemini-egress");
    const buildParams = vi.fn(() => ({ prompt: "x" }));
    const fetchImpl = vi.fn();

    let caught: unknown;
    try {
      await geminiGenerateText({ operation: "generate_text", model: MODEL, buildParams, fetchImpl });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(AiProviderError);
    expect((caught as InstanceType<typeof AiProviderError>).code).toBe("ai_not_configured");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("modelo autorizado: llama al endpoint correcto y devuelve el texto del primer candidato", async () => {
    const { geminiGenerateText } = await import("./gemini-egress");
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text: "hola" }, { text: " mundo" }] } }] }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;

    const text = await geminiGenerateText({
      operation: "generate_text",
      model: MODEL,
      buildParams: () => ({ prompt: "di algo" }),
      fetchImpl,
    });

    expect(text).toBe("hola mundo");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toContain(encodeURIComponent(MODEL));
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("test-key-sintetica");
  });

  it("el endpoint responde con error: se traduce a AiProviderError sin filtrar el cuerpo", async () => {
    const { geminiGenerateText, AiProviderError } = await import("./gemini-egress");
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ error: { message: "prompt filtrado: dato sensible del cliente X" } }), {
        status: 400,
      }),
    ) as unknown as typeof fetch;

    let caught: unknown;
    try {
      await geminiGenerateText({
        operation: "generate_text",
        model: MODEL,
        buildParams: () => ({ prompt: "x" }),
        fetchImpl,
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(AiProviderError);
    const providerError = caught as InstanceType<typeof AiProviderError>;
    expect(providerError.code).toBe("ai_schema_rejected");
    expect(providerError.status).toBe(400);
    expect(providerError.message).not.toContain("dato sensible del cliente X");
  });
});
