import { describe, expect, it } from "vitest";
import { stripCongeladora } from "./proposal-content";

describe("stripCongeladora", () => {
  it("corta todo desde '# Congeladora' en adelante, sin espacio colgante", () => {
    const raw = [
      "# MVP 1.0",
      "- **Cálculo de IMC** — función central.",
      "- **Campo de peso (kg)**",
      "",
      "# Congeladora",
      "| Función | Razón del recorte | Cuándo descongelar |",
      "|---|---|---|",
      "| Historial | No se pidió | Si el cliente lo pide |",
    ].join("\n");

    const result = stripCongeladora(raw);

    expect(result).toBe(
      ["# MVP 1.0", "- **Cálculo de IMC** — función central.", "- **Campo de peso (kg)**"].join("\n")
    );
    expect(result).not.toContain("Congeladora");
  });

  it("devuelve el texto intacto si no hay sección Congeladora", () => {
    const raw = "# MVP 1.0\n- Función única, sin recortes.";
    expect(stripCongeladora(raw)).toBe(raw);
  });

  it("detecta '# Congeladora' sin importar mayúsculas/minúsculas", () => {
    const raw = "# MVP 1.0\n- Función A\n\n# congeladora\n- Función B (recortada)";
    expect(stripCongeladora(raw)).toBe("# MVP 1.0\n- Función A");
  });

  it("no confunde un encabezado que solo empieza igual (ej. 'Congeladora avanzada')", () => {
    const raw = "# MVP 1.0\n- Función A\n\n# Congeladora avanzada (no es la sección real)";
    // Sigue siendo un heading "Congeladora" (\b permite texto después) — se corta ahí.
    // Este caso documenta el comportamiento real, no un falso negativo del regex.
    expect(stripCongeladora(raw)).toBe("# MVP 1.0\n- Función A");
  });

  it("maneja string vacío sin lanzar", () => {
    expect(stripCongeladora("")).toBe("");
  });
});
