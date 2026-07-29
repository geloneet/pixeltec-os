import { describe, expect, test, vi, beforeEach } from "vitest";
import { SafeUserError, AiProviderError } from "@/lib/ai/errors";

/**
 * Saneamiento de errores en las Server Actions de borradores del blog — los 2
 * puntos de G-04 de este archivo (E0f-3a).
 *
 * El editor pinta el campo con `toast.error(draftResult.error ?? …)`, así que
 * un `AiProviderError` o un fallo de Drizzle acababan en pantalla.
 */

const { sessionUserIdMock, resolveBriefRowMock, resolvePostRowMock, generatePostFromBriefMock } =
  vi.hoisted(() => ({
    sessionUserIdMock: vi.fn(),
    resolveBriefRowMock: vi.fn(),
    resolvePostRowMock: vi.fn(),
    generatePostFromBriefMock: vi.fn(),
  }));

vi.mock("@/lib/auth/session", () => ({ requireUserSession: sessionUserIdMock }));
vi.mock("@/lib/db", () => ({
  db: { update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })) },
}));
vi.mock("@/lib/db/schema", () => ({ blogBriefs: { data: {} }, blogPosts: { id: {} } }));
vi.mock("../pg", () => ({
  resolveBriefRow: resolveBriefRowMock,
  resolvePostRow: resolvePostRowMock,
  publicId: vi.fn(() => "brief-1"),
  getUserDisplayName: vi.fn(async () => "Miguel"),
}));
vi.mock("../ai/generate-post", () => ({
  generatePostFromBrief: generatePostFromBriefMock,
  computeWordCount: vi.fn(() => 100),
  computeReadingTime: vi.fn(() => 1),
  generateSlug: vi.fn(() => "slug"),
}));

import { generateDraft, regenerateDraft } from "./drafts";

const PROVIDER_BODY =
  '{"error":{"type":"invalid_request_error","message":"prompt: Eres un redactor experto..."}}';
const RAW_SQL = "SELECT * FROM blog_posts WHERE id = $1";
const CLIENTE_CONFIDENCIAL = "Clínica Smile More — +5213221234567";
const STACK_INTERNO = "at Object.<anonymous> (/Users/pixeltec/pixeltec-os/src/lib/db/index.ts:42:11)";

const MARCADORES = [PROVIDER_BODY, RAW_SQL, CLIENTE_CONFIDENCIAL, STACK_INTERNO];

const MESSAGE_ENVENENADO = [PROVIDER_BODY, RAW_SQL, CLIENTE_CONFIDENCIAL, STACK_INTERNO].join(" | ");

type Result = { ok: boolean; error?: string };

function sinFugas(result: unknown) {
  const salida = JSON.stringify(result);
  for (const marcador of MARCADORES) {
    expect(salida).not.toContain(marcador);
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  sessionUserIdMock.mockResolvedValue({ userId: "user-1", email: "staff@ejemplo.mx", role: "staff" });
  resolveBriefRowMock.mockResolvedValue({ id: "row-1", data: { titulo: "T" } });
  // `regenerateDraft` reconstruye el brief desde `briefSource`, no desde `data`.
  resolvePostRowMock.mockResolvedValue({
    id: "row-1",
    briefSource: { topic: "t", angle: "a", targetAudience: "pymes", keyPoints: [], tone: "claro" },
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  });
});

describe("generateDraft — el cuerpo del proveedor no llega al editor", () => {
  test("un error de IA con el prompt en el message devuelve el fallback", async () => {
    generatePostFromBriefMock.mockRejectedValueOnce(new Error(MESSAGE_ENVENENADO));

    const result = (await generateDraft("brief-1")) as Result;

    expect(result.ok).toBe(false);
    expect(result.error).toBe("Error generando borrador");
    sinFugas(result);
  });

  test("un AiProviderError no conserva su message", async () => {
    generatePostFromBriefMock.mockRejectedValueOnce(
      new AiProviderError({
        provider: "anthropic",
        operation: "generate_text",
        code: "ai_provider_error",
        status: 429,
      })
    );

    const result = (await generateDraft("brief-1")) as Result;

    expect(result.error).toBe("Error generando borrador");
    expect(JSON.stringify(result)).not.toContain("anthropic");
  });

  test("un fallo de Drizzle no revela SQL", async () => {
    generatePostFromBriefMock.mockRejectedValueOnce(
      Object.assign(new Error("null value violates not-null constraint"), {
        name: "PostgresError",
        query: RAW_SQL,
        stack: STACK_INTERNO,
      })
    );

    const result = (await generateDraft("brief-1")) as Result;

    expect(result.error).toBe("Error generando borrador");
    sinFugas(result);
  });

  test("un SafeUserError sí conserva su texto: es validación nuestra", async () => {
    generatePostFromBriefMock.mockRejectedValueOnce(
      new SafeUserError("Créditos insuficientes. Necesitas 6, tienes 2.", "insufficient_credits")
    );

    const result = (await generateDraft("brief-1")) as Result;

    expect(result.error).toBe("Créditos insuficientes. Necesitas 6, tienes 2.");
  });

  test("los rechazos previos al try conservan su texto propio", async () => {
    sessionUserIdMock.mockResolvedValueOnce(null);

    const result = (await generateDraft("brief-1")) as Result;

    expect(result).toEqual({ ok: false, error: "No autenticado" });
  });
});

describe("regenerateDraft — mismo criterio", () => {
  test("un error desconocido devuelve el fallback propio", async () => {
    generatePostFromBriefMock.mockRejectedValueOnce(new Error(MESSAGE_ENVENENADO));

    const result = (await regenerateDraft("post-1")) as Result;

    expect(result.ok).toBe(false);
    expect(result.error).toBe("Error regenerando borrador");
    sinFugas(result);
  });
});
