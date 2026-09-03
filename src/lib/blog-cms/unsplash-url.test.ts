import { describe, expect, it } from "vitest";
import { parseUnsplashImageUrl } from "./unsplash-url";

describe("parseUnsplashImageUrl — WO-2026-00198 (pegar URL de Unsplash como portada)", () => {
  it("acepta una URL directa de la CDN de Unsplash", () => {
    const url = "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?q=80&w=2070&auto=format&fit=crop";
    expect(parseUnsplashImageUrl(url)).toEqual({ ok: true, url });
  });

  it("acepta plus.unsplash.com (fotos premium)", () => {
    const url = "https://plus.unsplash.com/premium_photo-123?w=2070";
    expect(parseUnsplashImageUrl(url)).toEqual({ ok: true, url });
  });

  it("recorta espacios alrededor de la URL", () => {
    const url = "https://images.unsplash.com/photo-abc";
    expect(parseUnsplashImageUrl(`  ${url}  `)).toEqual({ ok: true, url });
  });

  it("rechaza la página de la foto (unsplash.com/photos/…), no la imagen", () => {
    const res = parseUnsplashImageUrl("https://unsplash.com/photos/algo-abc123");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/página de la foto/i);
  });

  it("rechaza dominios ajenos, aunque contengan 'unsplash'", () => {
    expect(parseUnsplashImageUrl("https://images.unsplash.com.evil.example/x").ok).toBe(false);
    expect(parseUnsplashImageUrl("https://not-unsplash.com/photo.jpg").ok).toBe(false);
  });

  it("rechaza http (no https)", () => {
    expect(parseUnsplashImageUrl("http://images.unsplash.com/photo-abc").ok).toBe(false);
  });

  it("rechaza URLs inválidas o vacías", () => {
    expect(parseUnsplashImageUrl("").ok).toBe(false);
    expect(parseUnsplashImageUrl("   ").ok).toBe(false);
    expect(parseUnsplashImageUrl("no-es-una-url").ok).toBe(false);
    expect(parseUnsplashImageUrl("javascript:alert(1)").ok).toBe(false);
  });
});
