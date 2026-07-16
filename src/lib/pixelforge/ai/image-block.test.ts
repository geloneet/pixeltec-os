import { describe, expect, it } from "vitest";
import { buildImageBlock } from "./image-block";

describe("buildImageBlock", () => {
  it("arma un content block image con source url (SDK 0.91 URLImageSource) — sin base64", () => {
    const block = buildImageBlock("https://assets.pixeltec.mx/pixelforge/ref-123.png");

    expect(block).toEqual({
      type: "image",
      source: { type: "url", url: "https://assets.pixeltec.mx/pixelforge/ref-123.png" },
    });
  });

  it("usa la URL recibida tal cual, sin transformarla", () => {
    const url = "https://r2.example.com/bucket/path/con%20espacios.jpg?x=1&y=2";
    const block = buildImageBlock(url);

    expect(block.source).toEqual({ type: "url", url });
  });
});
