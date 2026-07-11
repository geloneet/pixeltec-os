/**
 * GET /api/definition/[id]/export?doc=origen|mvp|flujo
 *
 * Devuelve el documento sellado de una estación entregable como Markdown
 * descargable. 404 si la estación aún no está sellada. Escopado por owner.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { getClientById } from "@/lib/db/repos/crm";
import { getDefinitionFull } from "@/lib/db/repos/definitions";
import { getMetaByExportSlug } from "@/lib/definition/station-meta";

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "definicion"
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const ownerId = session?.user?.id;
  if (!ownerId) return new NextResponse("No autenticado", { status: 401 });

  const { id } = await params;
  const doc = req.nextUrl.searchParams.get("doc") ?? "";
  const meta = getMetaByExportSlug(doc);
  if (!meta) return new NextResponse("Documento inválido", { status: 400 });

  const full = await getDefinitionFull(id, ownerId);
  if (!full) return new NextResponse("Definición no encontrada", { status: 404 });

  const station = full.stations.find((s) => s.station === meta.id);
  if (!station || station.status !== "sealed" || !station.sealedContent) {
    return new NextResponse("Documento aún no sellado", { status: 404 });
  }

  const client = await getClientById(full.definition.clientId, ownerId);
  const sealedAt = station.sealedAt
    ? new Date(station.sealedAt).toLocaleDateString("es-MX", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "—";

  const frontMatter = [
    `<!--`,
    `Documento: ${meta.sealName}`,
    `Definición: ${full.definition.title}`,
    `Cliente: ${client?.name ?? "—"}`,
    `Sellado por: ${station.sealedByName ?? "—"} el ${sealedAt}`,
    `-->`,
    "",
  ].join("\n");

  const body = `${frontMatter}${station.sealedContent}\n`;
  const filename = `${slugify(full.definition.title)}-${meta.exportSlug}.md`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
