import { describe, expect, it } from "vitest";
import { extractMapsEmbedUrl } from "./maps-embed";

describe("extractMapsEmbedUrl — paridad Encino (blog-html.ts)", () => {
  it("acepta una URL suelta del embed oficial de Google Maps", () => {
    expect(extractMapsEmbedUrl("https://www.google.com/maps/embed?pb=abc")).toBe(
      "https://www.google.com/maps/embed?pb=abc",
    );
  });

  it("acepta un <iframe> pegado y extrae su src", () => {
    const pasted = '<iframe src="https://www.google.com/maps/embed?pb=xyz" width="600" height="450"></iframe>';
    expect(extractMapsEmbedUrl(pasted)).toBe("https://www.google.com/maps/embed?pb=xyz");
  });

  it("acepta dominios regionales de Google (google.com.mx, etc.)", () => {
    expect(extractMapsEmbedUrl("https://google.com.mx/maps/embed?pb=1")).toBe(
      "https://google.com.mx/maps/embed?pb=1",
    );
  });

  it("rechaza cualquier cosa que no sea un embed oficial de Maps", () => {
    expect(extractMapsEmbedUrl("https://evil.example.com/maps/embed?pb=1")).toBeNull();
    expect(extractMapsEmbedUrl("https://www.google.com/search?q=maps")).toBeNull();
    expect(extractMapsEmbedUrl('<iframe src="https://evil.example.com"></iframe>')).toBeNull();
    expect(extractMapsEmbedUrl("javascript:alert(1)")).toBeNull();
  });

  it("cadena vacía o solo espacios → null", () => {
    expect(extractMapsEmbedUrl("")).toBeNull();
    expect(extractMapsEmbedUrl("   ")).toBeNull();
  });
});
