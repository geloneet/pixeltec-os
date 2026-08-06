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

const PROJECT_WRITERS: Array<{ file: string; fn: string }> = [
  { file: "./discovery.ts", fn: "createDiscoverySession" },
  { file: "./discovery.ts", fn: "assignDiscoveryToProject" },
  { file: "./strategies.ts", fn: "createStrategy" },
  { file: "./strategies.ts", fn: "assignStrategyToProject" },
];

/**
 * Escrituras que reciben un clientId del llamador. En una LECTURA usar el
 * resolver plano es inocuo (la query vuelve a filtrar por ownerId), pero al
 * persistir el ownerId es el del llamador y el clientId el que él mande: nada
 * posterior lo detecta. Un contrato así, una vez firmado, aparece además en el
 * portal del cliente real.
 */
const CLIENT_WRITERS: Array<{ file: string; fn: string }> = [
  { file: "./contracts.ts", fn: "createContract" },
  { file: "./contracts.ts", fn: "confirmContractFromWizard" },
  { file: "./proposals.ts", fn: "createProposal" },
  { file: "./invoices.ts", fn: "createInvoice" },
  { file: "./discovery.ts", fn: "createDiscoverySession" },
  { file: "./strategies.ts", fn: "createStrategy" },
];

describe("contrato anti-IDOR de projectId", () => {
  test.each(PROJECT_WRITERS)("$fn resuelve el proyecto verificando el dueño", ({ file, fn }) => {
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

describe("contrato anti-IDOR de clientId", () => {
  test.each(CLIENT_WRITERS)("$fn resuelve el cliente verificando el dueño", ({ file, fn }) => {
    const body = bodyOf(readSrc(file), fn);
    expect(body).toContain("resolveOwnedClientPgId");
    expect(body).not.toMatch(/await resolveClientPgId\(/);
  });

  test("resolveOwnedClientPgId filtra por clients.ownerId", () => {
    const body = bodyOf(readSrc("./pg.ts"), "resolveOwnedClientPgId");
    expect(body).toContain("clients.ownerId");
  });

  test("resolveOwnedProposalPgId compara ownerId de la propuesta", () => {
    const body = bodyOf(readSrc("./pg.ts"), "resolveOwnedProposalPgId");
    expect(body).toContain("row.ownerId !== ownerId");
  });
});
