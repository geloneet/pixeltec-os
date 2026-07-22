import { describe, expect, it } from "vitest";
import { loadQaRunnerEnv } from "./env";

const FULL_ENV = {
  DATABASE_URL: "postgres://u:p@db:5432/x",
  QA_PREVIEW_TOKEN_SECRET: "secret",
  QA_INTERNAL_APP_URL: "http://app:3000/",
  R2_ENDPOINT: "https://r2.example.com",
  R2_ACCESS_KEY_ID: "id",
  R2_SECRET_ACCESS_KEY: "key",
  R2_BUCKET_NAME: "bucket",
  R2_PUBLIC_URL: "https://cdn.example.com",
};

describe("loadQaRunnerEnv", () => {
  it("con todas las claves presentes, devuelve la config y recorta el trailing slash de appBaseUrl", () => {
    const config = loadQaRunnerEnv(FULL_ENV);
    expect(config.databaseUrl).toBe(FULL_ENV.DATABASE_URL);
    expect(config.previewTokenSecret).toBe(FULL_ENV.QA_PREVIEW_TOKEN_SECRET);
    expect(config.appBaseUrl).toBe("http://app:3000");
    expect(config.r2BucketName).toBe("bucket");
  });

  it("sin trailing slash no cambia nada", () => {
    const config = loadQaRunnerEnv({ ...FULL_ENV, QA_INTERNAL_APP_URL: "http://app:3000" });
    expect(config.appBaseUrl).toBe("http://app:3000");
  });

  it("una clave faltante lanza un error que la menciona", () => {
    const { DATABASE_URL, ...rest } = FULL_ENV;
    expect(() => loadQaRunnerEnv(rest)).toThrow(/DATABASE_URL/);
  });

  it("varias claves faltantes: el error las lista TODAS, no solo la primera", () => {
    const partial = { DATABASE_URL: FULL_ENV.DATABASE_URL };
    try {
      loadQaRunnerEnv(partial);
      throw new Error("no debería llegar aquí");
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toMatch(/QA_PREVIEW_TOKEN_SECRET/);
      expect(message).toMatch(/QA_INTERNAL_APP_URL/);
      expect(message).toMatch(/R2_ENDPOINT/);
      expect(message).toMatch(/R2_ACCESS_KEY_ID/);
      expect(message).toMatch(/R2_SECRET_ACCESS_KEY/);
      expect(message).toMatch(/R2_BUCKET_NAME/);
      expect(message).toMatch(/R2_PUBLIC_URL/);
    }
  });

  it("una clave presente pero vacía cuenta como faltante", () => {
    expect(() => loadQaRunnerEnv({ ...FULL_ENV, QA_PREVIEW_TOKEN_SECRET: "  " })).toThrow(
      /QA_PREVIEW_TOKEN_SECRET/
    );
  });
});
