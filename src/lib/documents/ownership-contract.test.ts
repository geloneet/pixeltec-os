import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * ADR-0036 — pertenencia obligatoria en toda escritura con IDs controlados por
 * el llamador.
 *
 * `resolveClientPgId`, `resolveProjectPgId` y `resolveProposalPgId` buscan en
 * TODA la tabla. En una LECTURA es inocuo (la consulta posterior re-filtra por
 * `ownerId`); en una ESCRITURA no, porque el `ownerId` que se persiste es el
 * del llamador y el id del recurso el que él mande.
 *
 * El ataque que esto cierra: fabricar un contrato sobre el cliente de otro
 * owner que, al firmarse, aparece —y se descarga en PDF— desde el portal de
 * ese cliente real, ya que el portal filtra por `clientId` + `status:firmado`
 * sin mirar `ownerId`.
 *
 * Es un contrato a nivel de FUENTE porque lo que se protege es la elección del
 * resolver: un test de runtime pasaría igual usando el resolver inseguro
 * mientras el owner del caso feliz coincida.
 */

const read = (rel: string) => readFileSync(resolve(__dirname, rel), "utf8");

function bodyOf(src: string, fnName: string): string {
  const start = src.indexOf(`export async function ${fnName}`);
  if (start === -1) throw new Error(`No se encontró ${fnName}`);
  const next = src.indexOf("\nexport async function", start + 1);
  return src.slice(start, next === -1 ? undefined : next);
}

/** Escrituras que reciben un clientId del llamador y persisten con él. */
const CLIENT_WRITERS = [
  { file: "./contracts.ts", fn: "createContract" },
  { file: "./contracts.ts", fn: "confirmContractFromWizard" },
  { file: "./proposals.ts", fn: "createProposal" },
  { file: "./invoices.ts", fn: "createInvoice" },
  { file: "./discovery.ts", fn: "createDiscoverySession" },
  { file: "./strategies.ts", fn: "createStrategy" },
];

/** Escrituras que reciben un projectId del llamador y lo persisten como FK. */
const PROJECT_WRITERS = [
  { file: "./discovery.ts", fn: "createDiscoverySession" },
  { file: "./discovery.ts", fn: "assignDiscoveryToProject" },
  { file: "./strategies.ts", fn: "createStrategy" },
  { file: "./strategies.ts", fn: "assignStrategyToProject" },
];

/** Escrituras que vinculan una propuesta indicada por el llamador. */
const PROPOSAL_WRITERS = [
  { file: "./contracts.ts", fn: "createContract" },
  { file: "./contracts.ts", fn: "updateContract" },
  { file: "./contracts.ts", fn: "confirmContractFromWizard" },
];

describe("ADR-0036 — pertenencia en escrituras con clientId del llamador", () => {
  test.each(CLIENT_WRITERS)("$fn verifica el dueño del cliente", ({ file, fn }) => {
    const body = bodyOf(read(file), fn);
    expect(body).toContain("resolveOwnedClientPgId");
    expect(body).not.toMatch(/await resolveClientPgId\(/);
  });
});

describe("ADR-0036 — pertenencia en escrituras con projectId del llamador", () => {
  test.each(PROJECT_WRITERS)("$fn verifica el dueño del proyecto", ({ file, fn }) => {
    const body = bodyOf(read(file), fn);
    expect(body).toContain("resolveOwnedProjectPgId");
    expect(body).not.toMatch(/await resolveProjectPgId\(/);
  });
});

describe("ADR-0036 — pertenencia en escrituras con proposalId del llamador", () => {
  test.each(PROPOSAL_WRITERS)("$fn verifica el dueño de la propuesta", ({ file, fn }) => {
    const body = bodyOf(read(file), fn);
    expect(body).toContain("resolveOwnedProposalPgId");
    expect(body).not.toMatch(/await resolveProposalPgId\(/);
  });
});

describe("los resolvers seguros filtran de verdad", () => {
  const pg = read("./pg.ts");

  test("resolveOwnedClientPgId compara clients.ownerId", () => {
    expect(bodyOf(pg, "resolveOwnedClientPgId")).toContain("clients.ownerId");
  });

  test("resolveOwnedProjectPgId llega a clients.ownerId por join", () => {
    const body = bodyOf(pg, "resolveOwnedProjectPgId");
    // `projects` no tiene owner_id propio: cuelga de clients.
    expect(body).toContain("innerJoin(clients");
    expect(body).toContain("clients.ownerId");
  });

  test("resolveOwnedProposalPgId compara el ownerId de la fila", () => {
    expect(bodyOf(pg, "resolveOwnedProposalPgId")).toContain("row.ownerId !== ownerId");
  });
});
