import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { requireSession } from "@/lib/vpsClient";
import { getProposalByToken } from "@/lib/documents/proposals-admin";
import { findProposalByPublicId } from "@/lib/documents/pg";
import type { Proposal } from "@/types/documents";

const execFileAsync = promisify(execFile);

// El armado del <Document> (JSX de @react-pdf/renderer) vive en un proceso
// de Node aparte — ver src/lib/documents/pdf-render-worker/render-proposal.mjs
// para el porqué (React error #31 al pasar por el bundler de Next.js, sin
// importar la ubicación del archivo). Esta ruta solo resuelve el proposal,
// invoca el worker, y devuelve el PDF que este escribió a disco.
const WORKER_PATH = path.join(
  process.cwd(),
  "src/lib/documents/pdf-render-worker/render-proposal.mjs",
);

async function generateProposalPdf(proposal: Proposal & { id: string }): Promise<Buffer> {
  const dir = await mkdtemp(path.join(tmpdir(), "proposal-pdf-"));
  const inputPath = path.join(dir, "input.json");
  const outputPath = path.join(dir, "output.pdf");
  try {
    await writeFile(inputPath, JSON.stringify(proposal), "utf-8");
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
    let proposal: (Proposal & { id: string }) | null = null;

    const token = req.nextUrl.searchParams.get("token");
    const proposalId = req.nextUrl.searchParams.get("proposalId");

    if (token) {
      proposal = await getProposalByToken(token);
    } else if (proposalId) {
      // Admin-only by session
      const cookieStore = await cookies();
      const sessionCookie = cookieStore.get("__session")?.value ?? "";
      const session = await requireSession(sessionCookie);
      if (!session.ok) return new NextResponse("Unauthorized", { status: 401 });

      const found = await findProposalByPublicId(proposalId);
      if (!found) return new NextResponse("Not found", { status: 404 });
      if (found.uid !== session.uid) return new NextResponse("Forbidden", { status: 403 });
      proposal = found;
    }

    if (!proposal) return new NextResponse("Not found", { status: 404 });

    const pdf = await generateProposalPdf(proposal);
    const safeName = proposal.reference ?? `propuesta-${proposal.id.slice(0, 6)}`;

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[proposal-pdf]", err);
    return new NextResponse("Internal error", { status: 500 });
  }
}
