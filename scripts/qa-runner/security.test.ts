import { describe, expect, it } from "vitest";
import { decideRequest, originOf } from "./security";

const ALLOWED = "http://app:3000";

describe("originOf", () => {
  it("extrae protocol+host+port", () => {
    expect(originOf("http://app:3000/proyectos/x")).toBe("http://app:3000");
    expect(originOf("https://cdn.example.com/img.png?x=1")).toBe("https://cdn.example.com");
  });

  it("null para una URL que no parsea", () => {
    expect(originOf("not-a-url")).toBeNull();
    expect(originOf("")).toBeNull();
  });
});

describe("decideRequest — allowlist de egress (req. 14)", () => {
  it("same-origin exacto se permite para cualquier resourceType", () => {
    expect(decideRequest("http://app:3000/preview", "document", ALLOWED)).toEqual({
      allow: true,
      reason: "same-origin",
    });
    expect(decideRequest("http://app:3000/_next/script.js", "script", ALLOWED)).toEqual({
      allow: true,
      reason: "same-origin",
    });
  });

  it("un subdominio hostil del origin permitido NO cuenta como same-origin", () => {
    expect(decideRequest("http://evil.app:3000/x", "document", ALLOWED)).toEqual({
      allow: false,
      reason: "blocked-external",
    });
    expect(decideRequest("http://app.evil.com:3000/x", "document", ALLOWED)).toEqual({
      allow: false,
      reason: "blocked-external",
    });
  });

  it("un puerto distinto del origin permitido NO cuenta como same-origin", () => {
    expect(decideRequest("http://app:9999/x", "document", ALLOWED)).toEqual({
      allow: false,
      reason: "blocked-external",
    });
  });

  it("imagen https externa se permite como excepción documentada", () => {
    expect(decideRequest("https://cdn.example.com/foto.png", "image", ALLOWED)).toEqual({
      allow: true,
      reason: "external-image",
    });
  });

  it("imagen http (NO https) externa se bloquea — la excepción es solo https", () => {
    expect(decideRequest("http://cdn.example.com/foto.png", "image", ALLOWED)).toEqual({
      allow: false,
      reason: "blocked-external",
    });
  });

  it("script/estilo/fetch/font/websocket externos se bloquean sin excepción", () => {
    for (const resourceType of ["script", "stylesheet", "xhr", "fetch", "font", "websocket", "other"]) {
      expect(decideRequest("https://evil.example.com/x", resourceType, ALLOWED)).toEqual({
        allow: false,
        reason: "blocked-external",
      });
    }
  });

  it("un redirect fuera de origin se modela como una nueva request al destino externo — se bloquea igual", () => {
    // Playwright reintenta el redirect como una request nueva contra la URL
    // de destino; ese destino pasa por el MISMO gate. Aquí se simula esa
    // request de destino.
    expect(decideRequest("https://attacker.example.com/steal", "document", ALLOWED)).toEqual({
      allow: false,
      reason: "blocked-external",
    });
  });

  it("un esquema no-http como javascript: nunca cuenta como same-origin ni como imagen (origin WHATWG es el string literal 'null')", () => {
    expect(decideRequest("javascript:alert(1)", "image", ALLOWED)).toEqual({
      allow: false,
      reason: "blocked-external",
    });
  });

  it("una URL realmente inválida (sin protocolo reconocible) se bloquea", () => {
    expect(decideRequest("::::not-a-url", "document", ALLOWED)).toEqual({
      allow: false,
      reason: "invalid-url",
    });
  });
});
