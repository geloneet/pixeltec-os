import { describe, expect, it } from "vitest";
import {
  extractErrorMessage,
  formatRelative,
  importanceFromPriority,
  IMPORTANCE_LEVELS,
  MODE_META,
  modeLabel,
  resolveMode,
  VERSION_STATUS_META,
} from "./meta";

describe("meta — fuente única de semántica del módulo", () => {
  it("cubre los tres modos con label, shortLabel, icono y clases", () => {
    for (const mode of ["BOT", "HUMAN", "PAUSED"] as const) {
      const m = MODE_META[mode];
      expect(m.label).toBeTruthy();
      expect(m.shortLabel).toBeTruthy();
      expect(m.icon).toBeTruthy();
      expect(m.className).toContain("border-");
      expect(m.activeClassName).toContain("bg-");
    }
  });

  it("resolveMode trata modo ausente como BOT (docs previos al takeover)", () => {
    expect(resolveMode(undefined)).toBe("BOT");
    expect(resolveMode(null)).toBe("BOT");
    expect(resolveMode("PAUSED")).toBe("PAUSED");
  });

  it("modeLabel resuelve la pausa temporal a 'hasta HH:MM'", () => {
    const future = new Date(Date.now() + 30 * 60_000).toISOString();
    expect(modeLabel("PAUSED", future)).toMatch(/^Bot pausado hasta \d{2}:\d{2}/);
    expect(modeLabel("PAUSED", null)).toBe("Bot pausado");
    expect(modeLabel("PAUSED", "fecha-invalida")).toBe("Bot pausado");
    expect(modeLabel("BOT")).toBe("Bot respondiendo");
  });

  it("los status de versión están traducidos (sin jerga en el recorrido principal)", () => {
    expect(VERSION_STATUS_META.draft.label).toBe("Borrador");
    expect(VERSION_STATUS_META.active.label).toBe("Activa");
    expect(VERSION_STATUS_META.archived.label).toBe("Archivada");
  });

  it("importancia ↔ manual_priority es un mapeo total sobre 0–20", () => {
    expect(importanceFromPriority(0).id).toBe("normal");
    expect(importanceFromPriority(8).id).toBe("normal");
    expect(importanceFromPriority(9).id).toBe("alta");
    expect(importanceFromPriority(15).id).toBe("alta");
    expect(importanceFromPriority(16).id).toBe("critica");
    expect(importanceFromPriority(20).id).toBe("critica");
    // Los niveles que la UI escribe caen dentro de su propio rango al releer.
    for (const level of IMPORTANCE_LEVELS) {
      expect(importanceFromPriority(level.priority).id).toBe(level.id);
    }
  });

  it("formatRelative distingue estilo compacto y frase, y tolera timestamps inválidos", () => {
    expect(formatRelative(undefined)).toBe("");
    expect(formatRelative(undefined, "phrase")).toBe("sin datos");
    expect(formatRelative("no-es-fecha", "phrase")).toBe("sin datos");
    const twoMinAgo = new Date(Date.now() - 2 * 60_000).toISOString().slice(0, 19).replace("T", " ");
    expect(formatRelative(twoMinAgo)).toBe("2m");
    expect(formatRelative(twoMinAgo, "phrase")).toBe("hace 2m");
  });

  it("extractErrorMessage cae en cascada error → detail → HTTP status", () => {
    expect(extractErrorMessage({ error: "a", detail: "b" }, 500)).toBe("a");
    expect(extractErrorMessage({ detail: "b" }, 500)).toBe("b");
    expect(extractErrorMessage({}, 503)).toBe("HTTP 503");
  });
});
