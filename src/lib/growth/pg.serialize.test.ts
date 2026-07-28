import { describe, expect, test, vi } from "vitest";

/**
 * Saneamiento EN LECTURA de `publishErrors` para filas históricas (E0f-3b).
 *
 * Las escrituras anteriores al gate guardaron `err.message` crudo en la
 * columna jsonb, y `serializePostRow` esparce la fila entera hacia las tres
 * rutas GET de posts. La fila NO se muta (la limpieza física va después del
 * snapshot): el reemplazo ocurre al serializar, así que las rutas quedan
 * cubiertas por el punto central sin editarse una por una.
 */

vi.mock("@/lib/db", () => ({ db: {} }));

import { serializePostRow } from "./pg";
import {
  PUBLISH_FAILED_MESSAGE,
  PUBLISH_NO_ACCOUNT_MESSAGE,
  sanitizePublishErrors,
} from "./social/publish-errors";

const PROVIDER_BODY = '{"error":{"message":"Invalid OAuth access token EAAG9ZBx0kZC","type":"OAuthException"}}';
const RAW_SQL = 'update "growth_posts" set "status" = $1';

function legacyRow(publishErrors: unknown) {
  return {
    id: "row-uuid",
    firestoreId: "fs-1",
    ownerId: "owner-1",
    status: "failed",
    caption: "Post",
    hashtags: [],
    publishErrors,
    publishedPlatforms: {},
    scheduledAt: null,
    publishedAt: null,
    createdAt: new Date("2026-07-01T00:00:00Z"),
    updatedAt: new Date("2026-07-01T00:00:00Z"),
  } as unknown as Parameters<typeof serializePostRow>[0];
}

describe("sanitizePublishErrors — lista blanca cerrada", () => {
  test("valores heredados desconocidos se reemplazan por el mensaje público", () => {
    expect(
      sanitizePublishErrors({ instagram: PROVIDER_BODY, cron: RAW_SQL })
    ).toEqual({ instagram: PUBLISH_FAILED_MESSAGE, cron: PUBLISH_FAILED_MESSAGE });
  });

  test("los valores seguros conocidos se conservan literales", () => {
    expect(
      sanitizePublishErrors({ facebook: PUBLISH_FAILED_MESSAGE, cron: PUBLISH_NO_ACCOUNT_MESSAGE })
    ).toEqual({ facebook: PUBLISH_FAILED_MESSAGE, cron: PUBLISH_NO_ACCOUNT_MESSAGE });
  });

  test("formas no-objeto degradan a objeto vacío", () => {
    expect(sanitizePublishErrors(null)).toEqual({});
    expect(sanitizePublishErrors("texto suelto")).toEqual({});
    expect(sanitizePublishErrors([PROVIDER_BODY])).toEqual({});
  });
});

describe("serializePostRow — las rutas GET nunca ven el valor heredado", () => {
  test("una fila histórica con texto crudo sale saneada", () => {
    const serialized = serializePostRow(legacyRow({ instagram: PROVIDER_BODY }));

    expect(serialized.publishErrors).toEqual({ instagram: PUBLISH_FAILED_MESSAGE });
    expect(JSON.stringify(serialized)).not.toContain("OAuthException");
    expect(JSON.stringify(serialized)).not.toContain(RAW_SQL);
  });

  test("una fila sana conserva sus valores y el resto del shape", () => {
    const serialized = serializePostRow(legacyRow({ cron: PUBLISH_NO_ACCOUNT_MESSAGE }));

    expect(serialized.publishErrors).toEqual({ cron: PUBLISH_NO_ACCOUNT_MESSAGE });
    expect(serialized.id).toBe("fs-1");
    expect(serialized.uid).toBe("owner-1");
    expect(serialized.status).toBe("failed");
  });
});
