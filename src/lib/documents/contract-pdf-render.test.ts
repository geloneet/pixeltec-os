import { describe, expect, test, vi, beforeEach } from "vitest";
import { writeFile } from "node:fs/promises";
import type { Contract } from "@/types/documents";

const { execFileMock } = vi.hoisted(() => ({ execFileMock: vi.fn() }));

// El worker real (render-contract.mjs) es un proceso hijo aparte — acá solo
// nos interesa verificar cómo generateContractPdf invoca execFile, no el
// render en sí (eso se prueba manualmente/por bisección, ver commit de este fix).
vi.mock("node:child_process", () => ({
  execFile: execFileMock,
}));

// generateContractPdf no usa db/pg — se mockean solo para que el import del
// módulo no arrastre @/lib/auth/session (next-auth) a un entorno de test node puro.
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/documents/pg", () => ({ resolveClientPgId: vi.fn() }));

const { generateContractPdf } = await import("./contract-pdf-render");

const contract: Contract & { id: string } = {
  id: "c1",
  clientId: "cl1",
  title: "Contrato de prueba",
  version: 1,
  status: "borrador",
  sections: [],
  signers: [],
} as unknown as Contract & { id: string };

describe("generateContractPdf", () => {
  beforeEach(() => {
    execFileMock.mockReset();
  });

  test("invoca el worker con un timeout acotado (para no colgar el proceso indefinidamente)", async () => {
    execFileMock.mockImplementation((_file, _args, options, callback) => {
      const outputPath = _args[2] as string;
      writeFile(outputPath, Buffer.from("%PDF-1.4 fake")).then(() => callback(null, "", ""));
    });

    await generateContractPdf(contract, "Cliente Demo");

    expect(execFileMock).toHaveBeenCalledTimes(1);
    const [, , options] = execFileMock.mock.calls[0];
    expect(options).toMatchObject({ timeout: expect.any(Number) });
    expect(options.timeout).toBeGreaterThan(0);
  });

  test("rechaza con error cuando el worker excede el timeout (en vez de colgarse)", async () => {
    execFileMock.mockImplementation((_file, _args, _options, callback) => {
      const err = Object.assign(new Error("Command failed"), { killed: true, signal: "SIGKILL" });
      callback(err, "", "");
    });

    await expect(generateContractPdf(contract, "Cliente Demo")).rejects.toThrow();
  });
});
