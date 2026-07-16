/**
 * Tests de la lógica PURA del repo de PixelForge — sin DB (no existe infra
 * de tests de DB en el repo; la transaccional se cubre en el smoke de fase).
 * Importar `./pixelforge` acá es seguro: el cliente de `postgres` que crea
 * `@/lib/db` es lazy (no conecta al importar, solo al ejecutar una query).
 */
import { describe, expect, it } from "vitest";
import { assertCombinedFromDirectionIdsValid } from "./pixelforge";

describe("assertCombinedFromDirectionIdsValid", () => {
  const chosenId = "chosen-1";
  const projectDirectionIds = ["chosen-1", "other-2", "other-3"];

  it("no lanza si combinedFromDirectionIds está vacío", () => {
    expect(() =>
      assertCombinedFromDirectionIdsValid(chosenId, [], projectDirectionIds)
    ).not.toThrow();
  });

  it("no lanza si todos los ids son otras direcciones del mismo proyecto", () => {
    expect(() =>
      assertCombinedFromDirectionIdsValid(
        chosenId,
        ["other-2", "other-3"],
        projectDirectionIds
      )
    ).not.toThrow();
  });

  it("lanza si combinedFromDirectionIds incluye la propia dirección elegida", () => {
    expect(() =>
      assertCombinedFromDirectionIdsValid(
        chosenId,
        ["other-2", chosenId],
        projectDirectionIds
      )
    ).toThrow(/no puede incluir la propia dirección elegida/);
  });

  it("lanza si combinedFromDirectionIds incluye un id que no pertenece al proyecto (IDOR)", () => {
    expect(() =>
      assertCombinedFromDirectionIdsValid(
        chosenId,
        ["other-2", "direccion-de-otro-proyecto"],
        projectDirectionIds
      )
    ).toThrow(/no pertenece a este proyecto: direccion-de-otro-proyecto/);
  });
});
