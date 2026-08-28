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
  it("proposal-pdf (Imprimir) sigue siendo embebible", () => {
    const p = "/api/documents/proposal-pdf";
    expect(isSelfFrameable(p)).toBe(true);
  });

  // WO-2026-00132: PixelForge se borró de verdad (código, rutas y su
  // excepción de framing). /proyectos ahora es «Trabajo», sin preview
  // embebible — no es frameable, igual que cualquier otra ruta ajena.
  it("una ruta ajena no es embebible", () => {
    for (const p of ["/", "/hoy", "/clientes/xyz", "/proyectos", "/proyectos/abc-123"]) {
      expect(isSelfFrameable(p)).toBe(false);
    }
  });
});

describe("buildCsp — matriz de framing", () => {
  // `frame-src 'self' https://www.google.com` es GLOBAL e incondicional (ver csp.ts): la CSP es
  // per-documento y no sobrevive la navegación cliente de una SPA, así que
  // TODAS las rutas la llevan por igual. Lo que sí varía por ruta es
  // `frame-ancestors` (quién puede embeber ESTE documento).
  it("Trabajo (/proyectos): frame-src 'self' https://www.google.com + frame-ancestors 'none'", () => {
    const csp = cspForPath(NONCE, "/proyectos/abc-123");
    expect(directive(csp, "frame-src")).toBe("frame-src 'self' https://www.google.com");
    expect(directive(csp, "frame-ancestors")).toBe("frame-ancestors 'none'");
  });

  it("proposal-pdf: frame-ancestors 'self' + frame-src 'self' https://www.google.com", () => {
    const csp = cspForPath(NONCE, "/api/documents/proposal-pdf");
    expect(directive(csp, "frame-ancestors")).toBe("frame-ancestors 'self'");
    expect(directive(csp, "frame-src")).toBe("frame-src 'self' https://www.google.com");
  });

  it("CRM (embedder de Imprimir): frame-src 'self' https://www.google.com (global) + frame-ancestors 'none'", () => {
    const csp = cspForPath(NONCE, "/clientes/cliente-123");
    expect(directive(csp, "frame-src")).toBe("frame-src 'self' https://www.google.com");
    expect(directive(csp, "frame-ancestors")).toBe("frame-ancestors 'none'");
  });

  it("ruta ajena: frame-src 'self' https://www.google.com (global) + frame-ancestors 'none'", () => {
    const csp = cspForPath(NONCE, "/");
    expect(directive(csp, "frame-src")).toBe("frame-src 'self' https://www.google.com");
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

describe("buildCsp — terceros del Pixel de Meta", () => {
  it("script-src incluye connect.facebook.net (fallback sin strict-dynamic)", () => {
    const csp = buildCsp(NONCE, { allowSelfFraming: false });
    expect(directive(csp, "script-src")).toContain("https://connect.facebook.net");
  });

  it("connect-src permite exactamente los endpoints de eventos del Pixel", () => {
    const csp = buildCsp(NONCE, { allowSelfFraming: false });
    expect(directive(csp, "connect-src")).toBe(
      "connect-src 'self' https://www.facebook.com https://connect.facebook.net"
    );
  });

  it("el resto de directivas no se relaja por el Pixel", () => {
    const csp = buildCsp(NONCE, { allowSelfFraming: false });
    expect(directive(csp, "default-src")).toBe("default-src 'self'");
    expect(directive(csp, "frame-src")).toBe("frame-src 'self' https://www.google.com");
    expect(directive(csp, "form-action")).toBe("form-action 'self'");
  });
});

describe("buildCsp — excepción mínima de Google Maps embed (WO-2026-00088, SC-2)", () => {
  const nonce = "n0nc3";
  const csp = buildCsp(nonce, { allowSelfFraming: false });
  const dir = (name: string) => csp.split("; ").find((d) => d.startsWith(`${name} `)) ?? "";

  it("frame-src permite exactamente 'self' y el origen del embed de Maps", () => {
    expect(dir("frame-src")).toBe("frame-src 'self' https://www.google.com");
  });

  it("sin comodines ni unsafe-eval fuera de development", () => {
    expect(csp).not.toMatch(/\*/);
    if (process.env.NODE_ENV !== "development") expect(csp).not.toContain("'unsafe-eval'");
  });

  it("el resto de directivas no se relaja por Maps", () => {
    expect(dir("default-src")).toBe("default-src 'self'");
    expect(dir("script-src")).not.toContain("google.com");
    expect(dir("connect-src")).not.toContain("google.com");
    expect(dir("img-src")).toBe("img-src 'self' data: blob: https:");
    expect(dir("object-src")).toBe("object-src 'none'");
    expect(dir("frame-ancestors")).toBe("frame-ancestors 'none'");
  });

  it("la excepción es global (per-documento) e idéntica en /whatsapp, /cobros y /blog", () => {
    for (const p of ["/whatsapp", "/cobros", "/blog/x", "/blog-cms"]) {
      const forPath = cspForPath(nonce, p);
      expect(forPath.split("; ").find((d) => d.startsWith("frame-src "))).toBe("frame-src 'self' https://www.google.com");
    }
  });
});
