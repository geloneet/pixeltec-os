import { describe, expect, test, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * `getNextInvoiceNumber` — regresión de la revisión de PR #98 (item 7): el
 * folio es company-global (mismo criterio que `invoices_number_idx`, unique
 * SIN owner_id), no por owner. Antes el conteo filtraba por `ownerId`, lo
 * que contradecía el constraint real y hacía que dos usuarios de PixelTEC
 * generando facturas el mismo año compitieran por el mismo número.
 */

function fnBody(): string {
  const src = readFileSync(resolve(__dirname, "./invoices.ts"), "utf8");
  const start = src.indexOf("export async function getNextInvoiceNumber");
  expect(start).toBeGreaterThan(-1);
  const end = src.indexOf("\nexport async function", start + 1);
  return src.slice(start, end === -1 ? undefined : end);
}

test("contrato de fuente: el conteo no filtra por ownerId (folio company-global, alineado al unique index global)", () => {
  const body = fnBody();
  expect(body).not.toMatch(/eq\(invoices\.ownerId/);
});

const mocks = vi.hoisted(() => {
  const selectWhere = vi.fn();
  const selectFrom = vi.fn(() => ({ where: selectWhere }));
  const select = vi.fn(() => ({ from: selectFrom }));
  const db = { select };
  return { requireOwner: vi.fn(), db, selectWhere };
});

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("./pg", () => ({ requireOwner: mocks.requireOwner }));

const { getNextInvoiceNumber } = await import("./invoices");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireOwner.mockResolvedValue({ uid: "u1", ownerId: "owner-1" });
  mocks.selectWhere.mockResolvedValue([{ n: 5 }]);
});

test("caso feliz: sigue calculando FAC-<año>-<n+1> con padding a 3 dígitos", async () => {
  const number = await getNextInvoiceNumber("u1");
  expect(number).toMatch(/^FAC-\d{4}-006$/);
});
