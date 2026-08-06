import { describe, expect, test } from "vitest";
import { isInternalPath, safeInternalPath } from "./internal-path";

/**
 * Frontera de "ruta interna" compartida por el redirect de /login y el `href`
 * de notificaciones. Los casos con backslash son los que los predicados
 * anteriores —basados en prefijos— dejaban pasar.
 */

describe("isInternalPath — acepta", () => {
  test.each([
    "/hoy",
    "/clientes/123",
    "/clientes/123?tab=comercial&sub=propuestas",
    "/cobros#seccion",
    "/",
  ])("%s", (v) => expect(isInternalPath(v)).toBe(true));
});

describe("isInternalPath — rechaza", () => {
  test.each([
    // Protocol-relative: el navegador lo resuelve como host externo.
    ["//evil.example", "protocol-relative"],
    // Backslash: se normaliza a "/" y termina siendo //evil.example.
    ["/\\evil.example", "backslash tras la barra"],
    ["\\\\evil.example", "doble backslash"],
    ["/\\/evil.example", "backslash mezclado"],
    ["/ruta/con\\backslash", "backslash en cualquier posición"],
    // URLs absolutas de cualquier esquema.
    ["https://evil.example/phish", "https absoluto"],
    ["http://evil.example", "http absoluto"],
    ["javascript:alert(1)", "javascript:"],
    ["data:text/html,<script>", "data:"],
    // Relativas sin barra: resuelven contra la ruta actual, no controlable.
    ["hoy", "sin barra inicial"],
    ["../admin", "traversal relativo"],
    ["", "cadena vacía"],
  ])("%s (%s)", (v) => expect(isInternalPath(v)).toBe(false));

  test("null y undefined", () => {
    expect(isInternalPath(null)).toBe(false);
    expect(isInternalPath(undefined)).toBe(false);
  });
});

describe("safeInternalPath", () => {
  test("conserva la ruta interna", () => {
    expect(safeInternalPath("/clientes/1?tab=comercial")).toBe("/clientes/1?tab=comercial");
  });

  test("cae al fallback ante cualquier destino externo", () => {
    expect(safeInternalPath("https://evil.example")).toBe("/hoy");
    expect(safeInternalPath("/\\evil.example")).toBe("/hoy");
    expect(safeInternalPath(null)).toBe("/hoy");
  });

  test("respeta un fallback propio", () => {
    expect(safeInternalPath("//evil.example", "/login")).toBe("/login");
  });
});
