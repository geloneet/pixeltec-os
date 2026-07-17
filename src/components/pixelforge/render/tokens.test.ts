import { describe, expect, it } from "vitest";
import { directionTokensToCssVars, type DesignTokens } from "./tokens";

function fixtureTokens(overrides: Partial<DesignTokens> = {}): DesignTokens {
  return {
    paleta: [
      { token: "color-primario", valor: "#0F172A", uso: "Fondos oscuros y texto principal." },
      { token: "color-fondo", valor: "#FFFFFF", uso: "Fondo general de la landing." },
      { token: "color-acento", valor: "#F59E0B", uso: "CTAs y detalles destacados." },
    ],
    tipografia: { display: "Fraunces", body: "Inter", escala: "Modular 1.25, base 16px" },
    radios: "suaves",
    espaciado: "equilibrado",
    ...overrides,
  };
}

describe("directionTokensToCssVars", () => {
  it("emite cada token de paleta bajo su slug --pf-*", () => {
    const vars = directionTokensToCssVars(fixtureTokens());
    expect(vars["--pf-color-primario"]).toBe("#0F172A");
    expect(vars["--pf-color-fondo"]).toBe("#FFFFFF");
    expect(vars["--pf-color-acento"]).toBe("#F59E0B");
  });

  it("sluguea tokens con acentos, mayúsculas y símbolos", () => {
    const vars = directionTokensToCssVars(
      fixtureTokens({
        paleta: [
          { token: "Verde Selección!", valor: "#0A7", uso: "Marca principal." },
          { token: "Fondo Papel", valor: "#FAFAF5", uso: "Fondo general." },
          { token: "Gris Tenue", valor: "#8A8A8A", uso: "Texto secundario." },
        ],
      })
    );
    expect(vars["--pf-verde-seleccion"]).toBe("#0A7");
    expect(vars["--pf-fondo-papel"]).toBe("#FAFAF5");
  });

  it("deriva roles semánticos estables por heurística de nombre/uso", () => {
    const vars = directionTokensToCssVars(fixtureTokens());
    expect(vars["--pf-primary"]).toBe("#0F172A"); // "color-primario"
    expect(vars["--pf-accent"]).toBe("#F59E0B"); // "color-acento"
    expect(vars["--pf-bg"]).toBe("#FFFFFF"); // "color-fondo"
    expect(vars["--pf-fg"]).toBe("#0F172A"); // uso "...texto principal"
    expect(vars["--pf-on-primary"]).toBe("#ffffff");
  });

  it("cae a valores neutros cuando ningún token matchea un rol", () => {
    const vars = directionTokensToCssVars(
      fixtureTokens({
        paleta: [
          { token: "tono-a", valor: "#111111", uso: "Uso a." },
          { token: "tono-b", valor: "#222222", uso: "Uso b." },
          { token: "tono-c", valor: "#333333", uso: "Uso c." },
        ],
      })
    );
    expect(vars["--pf-primary"]).toBe("#111111"); // fallback = paleta[0]
    expect(vars["--pf-bg"]).toBe("#ffffff");
    expect(vars["--pf-fg"]).toBe("#0f172a");
    expect(vars["--pf-muted"]).toBe("#64748b");
  });

  it("construye stacks tipográficos con la familia elegida + fallbacks", () => {
    const vars = directionTokensToCssVars(fixtureTokens());
    expect(vars["--pf-font-display"]).toBe("'Fraunces', ui-sans-serif, system-ui, sans-serif");
    expect(vars["--pf-font-body"]).toBe("'Inter', ui-sans-serif, system-ui, sans-serif");
  });

  it("mapea radios/espaciado/sombra a las vars de forma", () => {
    expect(directionTokensToCssVars(fixtureTokens({ radios: "rectos" }))["--pf-radius"]).toBe("0px");
    expect(directionTokensToCssVars(fixtureTokens({ radios: "redondeados" }))["--pf-radius"]).toBe("1rem");
    expect(directionTokensToCssVars(fixtureTokens({ espaciado: "compacto" }))["--pf-space"]).toBe("0.75rem");
    expect(directionTokensToCssVars(fixtureTokens({ espaciado: "aireado" }))["--pf-space"]).toBe("1.5rem");
    expect(directionTokensToCssVars(fixtureTokens({ sombra: "ninguna" }))["--pf-shadow"]).toBe("none");
    expect(directionTokensToCssVars(fixtureTokens({ sombra: "pronunciada" }))["--pf-shadow"]).toContain("40px");
  });

  it("sin sombra explícita usa un default sutil (no plano)", () => {
    const vars = directionTokensToCssVars(fixtureTokens());
    expect(vars["--pf-shadow"]).not.toBe("none");
    expect(vars["--pf-shadow"]).toContain("rgba");
  });
});
