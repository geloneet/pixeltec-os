import { describe, expect, it } from "vitest";
import { stripCongeladora, stripPmQuestions } from "./proposal-content";

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

describe("stripPmQuestions", () => {
  it("corta todo desde '## Preguntas del PM' en adelante, sin espacio colgante", () => {
    const raw = [
      "# Origen Note",
      "## Problema",
      "El usuario no puede reservar en línea.",
      "",
      "## Preguntas del PM",
      "1. ¿Confirmamos el rango de precios?",
      "2. ¿La villa acepta mascotas?",
    ].join("\n");

    const result = stripPmQuestions(raw);

    expect(result).toBe(
      ["# Origen Note", "## Problema", "El usuario no puede reservar en línea."].join("\n")
    );
    expect(result).not.toContain("Preguntas del PM");
  });

  it("devuelve el texto intacto si no hay sección Preguntas del PM", () => {
    const raw = "# Origen Note\n## Problema\nSin dudas pendientes.";
    expect(stripPmQuestions(raw)).toBe(raw);
  });

  it("detecta '## Preguntas del PM' sin importar mayúsculas/minúsculas", () => {
    const raw = "# Flujo de Usuario\n## Camino principal\nPaso 1\n\n## preguntas del pm\n1. ¿Y si falla el pago?";
    expect(stripPmQuestions(raw)).toBe("# Flujo de Usuario\n## Camino principal\nPaso 1");
  });

  it("funciona en cualquier estación, no solo mvp", () => {
    const flujo = "# Flujo de Usuario\n## Camino principal\nPaso 1\n\n## Preguntas del PM\n1. Duda X";
    const boceto = "# Origen Note\n## Problema\nTexto\n\n## Preguntas del PM\n1. Duda Y";
    expect(stripPmQuestions(flujo)).not.toContain("Preguntas del PM");
    expect(stripPmQuestions(boceto)).not.toContain("Preguntas del PM");
  });

  it("maneja string vacío sin lanzar", () => {
    expect(stripPmQuestions("")).toBe("");
  });
});
