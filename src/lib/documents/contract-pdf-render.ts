import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { resolveClientPgId } from "@/lib/documents/pg";
import type { Contract } from "@/types/documents";

const execFileAsync = promisify(execFile);

// El armado del <Document> (JSX de @react-pdf/renderer) vive en un proceso de
// Node aparte — ver src/lib/documents/pdf-render-worker/render-contract.mjs
// (mismo patrón que proposal-pdf, mismo motivo: React error #31).
const WORKER_PATH = path.join(
  process.cwd(),
  "src/lib/documents/pdf-render-worker/render-contract.mjs",
);

export async function resolveContractClientName(publicClientId: string): Promise<string> {
  const clientPgId = await resolveClientPgId(publicClientId);
  if (!clientPgId) return publicClientId;
  const [client] = await db
    .select({ name: clients.name })
    .from(clients)
    .where(eq(clients.id, clientPgId))
    .limit(1);
  return client?.name ?? publicClientId;
}

export async function generateContractPdf(contract: Contract & { id: string }, clientName: string): Promise<Buffer> {
  const dir = await mkdtemp(path.join(tmpdir(), "contract-pdf-"));
  const inputPath = path.join(dir, "input.json");
  const outputPath = path.join(dir, "output.pdf");
  try {
    await writeFile(inputPath, JSON.stringify({ ...contract, clientName }), "utf-8");
    await execFileAsync(process.execPath, [WORKER_PATH, inputPath, outputPath], {
      cwd: process.cwd(),
    });
    return await readFile(outputPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export function safeContractFilename(title: string, version: number): string {
  const safeName =
    title
      .replace(/[^a-zA-Z0-9_\- ]/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .slice(0, 100) || "contrato";
  return `${safeName}_v${version}.pdf`;
}

/**
 * Resuelve el nombre del cliente, genera el PDF y lo devuelve como respuesta
 * de descarga. Los dos routes (admin y portal) sólo hacen auth + verificación
 * de propiedad y luego delegan aquí, para no duplicar el armado de headers.
 */
export async function contractPdfResponse(contract: Contract & { id: string }): Promise<NextResponse> {
  const clientName = await resolveContractClientName(contract.clientId);
  const pdf = await generateContractPdf(contract, clientName);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeContractFilename(contract.title, contract.version)}"`,
      "Cache-Control": "no-store",
    },
  });
}
