import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { resolveClientPgId } from "@/lib/documents/pg";
import type { Invoice } from "@/types/documents";

const execFileAsync = promisify(execFile);

// El armado del <Document> (JSX de @react-pdf/renderer) vive en un proceso de
// Node aparte — ver src/lib/documents/pdf-render-worker/render-invoice.mjs
// (mismo patrón que contract-pdf/proposal-pdf, mismo motivo: React error #31).
const WORKER_PATH = path.join(
  process.cwd(),
  "src/lib/documents/pdf-render-worker/render-invoice.mjs",
);

export async function resolveInvoiceClientName(publicClientId: string): Promise<string> {
  const clientPgId = await resolveClientPgId(publicClientId);
  if (!clientPgId) return publicClientId;
  const [client] = await db
    .select({ name: clients.name })
    .from(clients)
    .where(eq(clients.id, clientPgId))
    .limit(1);
  return client?.name ?? publicClientId;
}

export async function generateInvoicePdf(invoice: Invoice & { id: string }, clientName: string): Promise<Buffer> {
  const dir = await mkdtemp(path.join(tmpdir(), "invoice-pdf-"));
  const inputPath = path.join(dir, "input.json");
  const outputPath = path.join(dir, "output.pdf");
  try {
    await writeFile(inputPath, JSON.stringify({ ...invoice, clientName }), "utf-8");
    await execFileAsync(process.execPath, [WORKER_PATH, inputPath, outputPath], {
      cwd: process.cwd(),
    });
    return await readFile(outputPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export function safeInvoiceFilename(number: string): string {
  return `${number.replace(/[^a-zA-Z0-9-]/g, "-")}.pdf`;
}
