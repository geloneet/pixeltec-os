import { describe, it, expect } from "vitest";
import {
  buildCsp,
  cspForPath,
  isSelfFrameable,
} from "./csp";

const NONCE = "testnonce";

/** Extrae el valor de una directiva de una cadena CSP (`; `-separada). */
function directive(csp: string, name: string): string | undefined {
  return csp
    .split("; ")
    .find((d) => d === name || d.startsWith(`${name} `));
}

describe("csp matchers", () => {
  it("preview PixelForge es embebible (frame-ancestors)", () => {
    const p = "/proyectos/pixelforge/abc-123/preview";
    expect(isSelfFrameable(p)).toBe(true);
  });

  it("la regex de preview es EXACTA — no matchea subrutas ni otras estaciones", () => {
    expect(isSelfFrameable("/proyectos/pixelforge/abc/preview/extra")).toBe(false);
    expect(isSelfFrameable("/proyectos/pixelforge/abc/produccion")).toBe(false);
    expect(isSelfFrameable("/proyectos/pixelforge/preview")).toBe(false); // falta el segmento id
  });

  it("produccion no es embebible (no matchea la regex de preview)", () => {
    const p = "/proyectos/pixelforge/abc-123/produccion";
    expect(isSelfFrameable(p)).toBe(false);
  });

  it("proposal-pdf (Imprimir) sigue siendo embebible", () => {
    const p = "/api/documents/proposal-pdf";
    expect(isSelfFrameable(p)).toBe(true);
  });

  it("una ruta ajena no es embebible", () => {
    for (const p of ["/", "/hoy", "/clientes/xyz", "/proyectos/otro"]) {
      expect(isSelfFrameable(p)).toBe(false);
    }
  });
});

describe("buildCsp — matriz de framing", () => {
  // `frame-src 'self'` es GLOBAL e incondicional (ver csp.ts): la CSP es
  // per-documento y no sobrevive la navegación cliente de una SPA, así que
  // TODAS las rutas la llevan por igual. Lo que sí varía por ruta es
  // `frame-ancestors` (quién puede embeber ESTE documento).
  it("preview: frame-ancestors 'self' + frame-src 'self'", () => {
    const csp = cspForPath(NONCE, "/proyectos/pixelforge/abc/preview");
    expect(directive(csp, "frame-ancestors")).toBe("frame-ancestors 'self'");
    expect(directive(csp, "frame-src")).toBe("frame-src 'self'");
  });

  it("produccion: frame-src 'self' + frame-ancestors 'none'", () => {
    const csp = cspForPath(NONCE, "/proyectos/pixelforge/abc/produccion");
    expect(directive(csp, "frame-src")).toBe("frame-src 'self'");
    expect(directive(csp, "frame-ancestors")).toBe("frame-ancestors 'none'");
  });

  it("proposal-pdf: frame-ancestors 'self' + frame-src 'self'", () => {
    const csp = cspForPath(NONCE, "/api/documents/proposal-pdf");
    expect(directive(csp, "frame-ancestors")).toBe("frame-ancestors 'self'");
    expect(directive(csp, "frame-src")).toBe("frame-src 'self'");
  });

  it("CRM (embedder de Imprimir): frame-src 'self' (global) + frame-ancestors 'none'", () => {
    const csp = cspForPath(NONCE, "/clientes/cliente-123");
    expect(directive(csp, "frame-src")).toBe("frame-src 'self'");
    expect(directive(csp, "frame-ancestors")).toBe("frame-ancestors 'none'");
  });

  it("ruta ajena: frame-src 'self' (global) + frame-ancestors 'none'", () => {
    const csp = cspForPath(NONCE, "/");
    expect(directive(csp, "frame-src")).toBe("frame-src 'self'");
    expect(directive(csp, "frame-ancestors")).toBe("frame-ancestors 'none'");
  });

  it("directivas base invariantes presentes y el nonce incrustado", () => {
    const csp = buildCsp(NONCE, { allowSelfFraming: false });
    expect(directive(csp, "default-src")).toBe("default-src 'self'");
    expect(directive(csp, "object-src")).toBe("object-src 'none'");
    expect(directive(csp, "base-uri")).toBe("base-uri 'self'");
    expect(directive(csp, "form-action")).toBe("form-action 'self'");
    expect(csp).toContain(`'nonce-${NONCE}'`);
    expect(csp).toContain("report-uri /api/csp-report");
  });
});
