import { describe, expect, it } from "vitest";
import { AI_ARTICLE_TONES, isAiArticleTone, toAiArticleParams } from "./ai-params";

describe("toAiArticleParams — paridad Encino (blog-ai-params.ts)", () => {
  it("null → null", () => {
    expect(toAiArticleParams(null)).toBeNull();
  });

  it("tono conocido se conserva", () => {
    const params = { brief: "b", tone: "educativo", audience: "pymes", internalLinkCount: 2, externalLinkCount: 1 };
    expect(toAiArticleParams(params)).toEqual(params);
  });

  it("tono desconocido cae a 'informativo' en vez de castear a ciegas", () => {
    const params = { brief: "b", tone: "sarcástico", audience: "pymes", internalLinkCount: 0, externalLinkCount: 0 };
    expect(toAiArticleParams(params)?.tone).toBe("informativo");
  });

  it("isAiArticleTone cubre exactamente los 6 tonos declarados", () => {
    expect(AI_ARTICLE_TONES).toHaveLength(6);
    for (const t of AI_ARTICLE_TONES) expect(isAiArticleTone(t)).toBe(true);
    expect(isAiArticleTone("inventado")).toBe(false);
  });
});
