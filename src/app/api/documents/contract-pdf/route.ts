import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { requireSession } from "@/lib/vpsClient";
import { findContractByPublicId, resolveClientPgId } from "@/lib/documents/pg";
import { resolveToken } from "@/lib/portal/token";
import type { Contract } from "@/types/documents";

const execFileAsync = promisify(execFile);

// El armado del <Document> (JSX de @react-pdf/renderer) vive en un proceso de
// Node aparte — ver src/lib/documents/pdf-render-worker/render-contract.mjs
// (mismo patrón que proposal-pdf, mismo motivo: React error #31).
const WORKER_PATH = path.join(
  process.cwd(),
  "src/lib/documents/pdf-render-worker/render-contract.mjs",
);

async function resolveClientName(publicClientId: string): Promise<string> {
  const clientPgId = await resolveClientPgId(publicClientId);
  if (!clientPgId) return publicClientId;
  const [client] = await db
    .select({ name: clients.name })
    .from(clients)
    .where(eq(clients.id, clientPgId))
    .limit(1);
  return client?.name ?? publicClientId;
}

async function generateContractPdf(contract: Contract & { id: string }, clientName: string): Promise<Buffer> {
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

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const contractId = req.nextUrl.searchParams.get("contractId");
    if (!contractId) {
      return new NextResponse("Missing contractId", { status: 400 });
    }

    // Auth — session cookie (admin) OR portal token (public portal)
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("__session")?.value ?? "";
    const session = await requireSession(sessionCookie);

    let ownerUid: string;
    let portalClientId: string | null = null;
    if (session.ok) {
      ownerUid = session.uid;
    } else {
      const portalToken = req.nextUrl.searchParams.get("token");
      if (!portalToken) return new NextResponse("Unauthorized", { status: 401 });
      const resolved = await resolveToken(portalToken);
      if (!resolved) return new NextResponse("Unauthorized", { status: 401 });
      ownerUid = resolved.uid;
      portalClientId = resolved.clientId;
    }

    const contract = await findContractByPublicId(contractId);
    if (!contract) {
      return new NextResponse("Contract not found", { status: 404 });
    }

    // Verify ownership
    if (contract.uid !== ownerUid) {
      return new NextResponse("Forbidden", { status: 403 });
    }
    // Verify the portal token's client owns this contract — multiple clients
    // of the same consultant share `uid`, so `uid` alone is not sufficient.
    if (portalClientId !== null && contract.clientId !== portalClientId) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const clientName = await resolveClientName(contract.clientId);
    const pdf = await generateContractPdf(contract, clientName);

    const safeName = (contract.title
      .replace(/[^a-zA-Z0-9_\- ]/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .slice(0, 100)) || "contrato";

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}_v${contract.version}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[contract-pdf]", err);
    return new NextResponse("Internal error", { status: 500 });
  }
}
