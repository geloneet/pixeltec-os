import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Contrato anti-IDOR de `projects`: la tabla no tiene `owner_id` propio (cuelga
 * de `clients`), así que `resolveProjectPgId` alcanza proyectos de CUALQUIER
 * dueño. Toda función que reciba un projectId del llamador y lo PERSISTA debe
 * pasar por `resolveOwnedProjectPgId`, que hace el join contra clients.ownerId.
 *
 * Es un test a nivel fuente —igual que el contrato anti-pisado de crm-actions—
 * porque lo que se protege es la elección del resolver, no un valor en runtime.
 */

function readSrc(relative: string): string {
  return readFileSync(resolve(__dirname, relative), "utf8");
}

function bodyOf(src: string, fnName: string): string {
  const start = src.indexOf(`export async function ${fnName}`);
  if (start === -1) throw new Error(`No se encontró ${fnName}`);
  const next = src.indexOf("\nexport async function", start + 1);
  return src.slice(start, next === -1 ? undefined : next);
}

const WRITERS: Array<{ file: string; fn: string }> = [
  { file: "./discovery.ts", fn: "createDiscoverySession" },
  { file: "./discovery.ts", fn: "assignDiscoveryToProject" },
  { file: "./strategies.ts", fn: "createStrategy" },
  { file: "./strategies.ts", fn: "assignStrategyToProject" },
];

describe("contrato anti-IDOR de projectId", () => {
  test.each(WRITERS)("$fn resuelve el proyecto verificando el dueño", ({ file, fn }) => {
    const body = bodyOf(readSrc(file), fn);
    expect(body).toContain("resolveOwnedProjectPgId");
    // El resolver sin filtro de dueño no debe usarse para persistir.
    expect(body).not.toMatch(/await resolveProjectPgId\(/);
  });

  test("resolveOwnedProjectPgId filtra por clients.ownerId", () => {
    const body = bodyOf(readSrc("./pg.ts"), "resolveOwnedProjectPgId");
    expect(body).toContain("innerJoin(clients");
    expect(body).toContain("clients.ownerId");
  });
});
