import { describe, expect, it } from "vitest";
import type { DesignTokens } from "@/components/pixelforge/render/tokens";
import { checkDesignTokens, checkNoChosenDirection } from "./design";

function baseTokens(overrides: Partial<DesignTokens> = {}): DesignTokens {
  return {
    paleta: [
      { token: "color-fondo", valor: "#ffffff", uso: "Fondo general de la landing." },
      { token: "color-texto", valor: "#0f172a", uso: "Texto principal del cuerpo." },
      { token: "color-primario", valor: "#1e3a8a", uso: "Color de marca para CTAs." },
      { token: "color-acento", valor: "#334155", uso: "Acento secundario." },
      { token: "color-muted", valor: "#475569", uso: "Texto secundario, bordes." },
    ],
    tipografia: { display: "Fraunces", body: "Inter", escala: "modular 1.25, base 16px" },
    radios: "suaves",
    espaciado: "equilibrado",
    ...overrides,
  };
}

function findingsFor(checkCode: string, findings: ReturnType<typeof checkDesignTokens>) {
  return findings.filter((f) => f.checkCode === checkCode);
}

describe("checkDesignTokens — dirección 'limpia' (sin findings)", () => {
  it("una dirección con roles bien matcheados y buen contraste no produce findings", () => {
    expect(checkDesignTokens(baseTokens())).toEqual([]);
  });
});

describe("QA-DI-001 — colisión B1 (paleta monocolor cae al mismo neutro que bg)", () => {
  it("una paleta monocolor sin keywords de marca produce colisión primary/fg ≡ bg", () => {
    const tokens = baseTokens({
      paleta: [
        { token: "tono-a", valor: "#0f172a", uso: "Color base del sitio." },
        { token: "tono-b", valor: "#0f172a", uso: "Fondo general de todas las secciones." },
        { token: "tono-c", valor: "#0f172a", uso: "Detalle decorativo menor." },
      ],
    });

    const findings = findingsFor("QA-DI-001", checkDesignTokens(tokens));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe("critical");
    expect(findings[0]!.blocking).toBe(true);
    expect(findings[0]!.description).toContain("--pf-primary");
  });
});

describe("QA-DI-002 — contraste WCAG server-side", () => {
  it("fg/bg con ratio < 3.0 produce major Y blocking=true", () => {
    const tokens = baseTokens({
      paleta: [
        { token: "color-fondo", valor: "#808080", uso: "Fondo general de la landing." },
        { token: "color-texto", valor: "#8a8a8a", uso: "Texto principal del cuerpo." },
        { token: "color-primario", valor: "#1e3a8a", uso: "Marca." },
        { token: "color-acento", valor: "#334155", uso: "Acento." },
        { token: "color-muted", valor: "#475569", uso: "Muted." },
      ],
    });
    const findings = findingsFor("QA-DI-002", checkDesignTokens(tokens));
    const fgBg = findings.find((f) => f.description.includes("--pf-fg/--pf-bg"));
    expect(fgBg).toBeDefined();
    expect(fgBg!.severity).toBe("major");
    expect(fgBg!.blocking).toBe(true);
  });

  it("accent/bg con ratio entre 3.0 y el mínimo requerido... y un color no parseable produce finding info separado", () => {
    const tokens = baseTokens({
      paleta: [
        { token: "color-fondo", valor: "#ffffff", uso: "Fondo general de la landing." },
        { token: "color-texto", valor: "#0f172a", uso: "Texto principal del cuerpo." },
        { token: "color-primario", valor: "#1e3a8a", uso: "Marca." },
        { token: "color-acento", valor: "azul cielo", uso: "Acento secundario." },
        { token: "color-muted", valor: "#475569", uso: "Muted." },
      ],
    });
    const findings = findingsFor("QA-DI-002", checkDesignTokens(tokens));
    const accentBg = findings.find((f) => f.description.includes("--pf-accent/--pf-bg"));
    expect(accentBg).toBeDefined();
    expect(accentBg!.severity).toBe("info");
    expect(accentBg!.blocking).toBe(false);
    expect(accentBg!.description).toContain("no es evaluable server-side");
  });
});

describe("QA-DI-003 — token descartado por sanitizeCssValue", () => {
  it("un token con valor hostil produce un finding minor por token", () => {
    const tokens = baseTokens({
      paleta: [
        ...baseTokens().paleta,
        { token: "color-extra", valor: "red; background:url(x)", uso: "Detalle decorativo." },
      ],
    });
    const findings = findingsFor("QA-DI-003", checkDesignTokens(tokens));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe("minor");
    expect(findings[0]!.blocking).toBe(false);
    expect(findings[0]!.description).toContain("color-extra");
  });
});

describe("QA-DI-004 — rol cayó al fallback (sin match por keyword)", () => {
  it("una paleta sin keywords para bg/primary/fg reporta los 3 roles en un único finding", () => {
    const tokens = baseTokens({
      paleta: [
        { token: "tono-a", valor: "#111111", uso: "Uso a." },
        { token: "tono-b", valor: "#222222", uso: "Uso b." },
        { token: "tono-c", valor: "#333333", uso: "Uso c." },
      ],
    });
    const findings = findingsFor("QA-DI-004", checkDesignTokens(tokens));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe("minor");
    expect(findings[0]!.description).toContain("bg");
    expect(findings[0]!.description).toContain("primary");
    expect(findings[0]!.description).toContain("fg");
  });
});

describe("QA-DI-005 — tipografía degradada a sans-serif", () => {
  it("una familia display 100% hostil degrada a sans-serif y produce finding minor", () => {
    const tokens = baseTokens({ tipografia: { display: "\";{}\\", body: "Roboto", escala: "modular" } });
    const findings = findingsFor("QA-DI-005", checkDesignTokens(tokens));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe("minor");
    expect(findings[0]!.location).toEqual({ slot: "tipografia.display" });
  });

  it("body también se evalúa independientemente de display", () => {
    const tokens = baseTokens({ tipografia: { display: "Fraunces", body: "\";{}\\", escala: "modular" } });
    const findings = findingsFor("QA-DI-005", checkDesignTokens(tokens));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.location).toEqual({ slot: "tipografia.body" });
  });
});

describe("QA-DI-006 — sin dirección chosen", () => {
  it("siempre produce un finding major no bloqueante", () => {
    const finding = checkNoChosenDirection();
    expect(finding.checkCode).toBe("QA-DI-006");
    expect(finding.severity).toBe("major");
    expect(finding.blocking).toBe(false);
  });
});

describe("checkDesignTokens — determinismo", () => {
  it("misma entrada produce la misma salida", () => {
    const tokens = baseTokens({
      paleta: [
        { token: "tono-a", valor: "#111111", uso: "Uso a." },
        { token: "tono-b", valor: "#222222", uso: "Uso b." },
      ],
    });
    expect(checkDesignTokens(tokens)).toEqual(checkDesignTokens(structuredClone(tokens)));
  });
});
