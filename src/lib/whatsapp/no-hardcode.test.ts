import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

/**
 * Regla fundamental de WO-2026-00019: los valores que Meta mostró al aprobar
 * la plantilla («Smile More Dental», «Guadalajara», «Corrección y adaptación
 * del sistema») son MUESTRAS. Ningún módulo genérico de WhatsApp ni el
 * resolver de /respuestas puede contenerlos. Este test es el grep permanente.
 */

const ROOTS = [join(__dirname), join(__dirname, "..", "respuestas")];
const FORBIDDEN = [/smile\s*more\s*dental/i, /guadalajara/i, /corrección y adaptación del sistema/i];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

describe("sin muestras de Meta hardcodeadas", () => {
  test("0 apariciones en src/lib/whatsapp y src/lib/respuestas (fuera de tests)", () => {
    const hits: string[] = [];
    for (const root of ROOTS) {
      for (const file of sourceFiles(root)) {
        const content = readFileSync(file, "utf8");
        for (const re of FORBIDDEN) {
          if (re.test(content)) hits.push(`${file} ~ ${re}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });
});
