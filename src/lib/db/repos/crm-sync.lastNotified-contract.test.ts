import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * `lastNotified` es cron-owned (el cron de cobros la avanza con un UPDATE
 * dirigido) — regresión de la revisión de PR #98 (item 5). Contrato a nivel
 * de FUENTE porque lo que se protege es que el blob-sync ni siquiera
 * MENCIONE la columna como valor asignado, ni en el INSERT (`.values(...)`)
 * ni en el UPDATE (`onConflictDoUpdate.set`) de `syncCharges` — un test de
 * runtime pasaría igual si alguien la vuelve a agregar solo en una de las
 * dos ramas mientras el caso feliz no la ejercite.
 */

function syncChargesBody(): string {
  const src = readFileSync(resolve(__dirname, "./crm-sync.ts"), "utf8");
  const start = src.indexOf("async function syncCharges");
  expect(start).toBeGreaterThan(-1);
  const end = src.indexOf("\nasync function", start + 1);
  return src.slice(start, end === -1 ? undefined : end);
}

describe("syncCharges — lastNotified nunca se asigna (ni insert ni update)", () => {
  test("el cuerpo de syncCharges no asigna la columna lastNotified en ningún lugar", () => {
    const body = syncChargesBody();
    // Coincide con `lastNotified:` como key de objeto (values/set); las
    // menciones en comentarios explicativos no llevan colon justo después.
    expect(body).not.toMatch(/lastNotified\s*:/);
  });

  test("sí sigue mencionando lastNotified en un comentario (documenta la exclusión, no la borra)", () => {
    const body = syncChargesBody();
    expect(body).toContain("lastNotified");
  });
});
