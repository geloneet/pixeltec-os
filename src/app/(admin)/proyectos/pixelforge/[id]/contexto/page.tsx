import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Brain, FileText, Import, Link2, StickyNote } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { auth } from "@/lib/auth/config";
import { getPixelforgeProjectFull } from "@/lib/db/repos/pixelforge";
import { AddContextSourceForm } from "@/components/pixelforge/AddContextSourceForm";
import { ContextBriefPanel } from "@/components/pixelforge/ContextBriefPanel";
import { SealBar } from "@/components/pixelforge/SealBar";
import type { PixelforgeSourceType } from "@/lib/pixelforge/types";
import type { ContextBrief } from "@/lib/pixelforge/schemas/analyze-context";

export const metadata: Metadata = {
  title: "Contexto — PixelForge — PixelTEC OS",
};

const SOURCE_ICON: Record<PixelforgeSourceType, typeof StickyNote> = {
  note: StickyNote,
  document: FileText,
  url: Link2,
  definition_import: Import,
};

const CONTENT_PREVIEW_LIMIT = 240;

export default async function PixelforgeContextoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const ownerId = session?.user?.id;
  if (!ownerId) redirect("/login?redirect=/proyectos/pixelforge");

  const { id } = await params;
  const full = await getPixelforgeProjectFull(id, ownerId);
  if (!full) notFound();

  const { project, sources, artifacts } = full;
  const brainDump = project.brainDump;
  const brainDumpIsLong = brainDump.length > 600;

  // Defensivo: `createPixelforgeProject` siempre crea las 5 filas de artifact
  // (una por `ARTIFACT_KINDS`) al crear el proyecto — no debería faltar.
  const artifact = artifacts.find((a) => a.kind === "context_brief");
  if (!artifact) notFound();

  const brief = (
    artifact.status === "sealed" ? artifact.sealedContent : artifact.currentDraft
  ) as ContextBrief | null;

  const sealedAtIso = artifact.sealedAt ? artifact.sealedAt.toISOString() : null;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="mb-6">
        <ContextBriefPanel
          projectId={id}
          artifactStatus={artifact.status}
          brief={brief}
          sealedInfo={{ byName: artifact.sealedByName, at: sealedAtIso }}
          lastRunId={artifact.lastRunId}
        />
      </div>

      <div className="mb-6">
        <SealBar
          projectId={id}
          artifactStatus={artifact.status}
          kind="context_brief"
          kindLabel="Context Brief"
          sealedByName={artifact.sealedByName}
          sealedAt={sealedAtIso}
          canSeal={artifact.currentDraft != null}
          // Reabrir el Context Brief SÍ invalida los sellos downstream
          // (estrategia/visual/direcciones/blueprint) — ver reopenArtifact.
          downstreamWarning={artifact.status === "sealed"}
        />
      </div>

      <div className="mx-auto max-w-3xl">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Brain className="h-4 w-4 text-muted-foreground" />
            Descarga mental
          </div>
          {brainDumpIsLong ? (
            <details>
              <summary className="cursor-pointer whitespace-pre-wrap text-sm text-foreground/90">
                {brainDump.slice(0, 600)}…
                <span className="ml-1 text-xs text-cyan-400">ver todo</span>
              </summary>
              <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/90">{brainDump}</p>
            </details>
          ) : (
            <p className="whitespace-pre-wrap text-sm text-foreground/90">{brainDump}</p>
          )}
        </div>

        <div className="mt-6 rounded-xl border border-border bg-card p-5">
          <div className="mb-3 text-sm font-medium text-foreground">Fuentes de contexto</div>
          {sources.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin fuentes anexadas todavía</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {sources.map((s) => {
                const Icon = SOURCE_ICON[s.type];
                const contentPreview =
                  s.content.length > CONTENT_PREVIEW_LIMIT
                    ? `${s.content.slice(0, CONTENT_PREVIEW_LIMIT)}…`
                    : s.content;
                return (
                  <li key={s.id} className="rounded-md border border-border/60 bg-secondary/20 p-3">
                    <div className="flex items-center gap-1.5">
                      <Icon className="h-3.5 w-3.5 flex-shrink-0 text-cyan-400" />
                      <span className="truncate text-sm font-medium text-foreground">{s.title}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                      {contentPreview}
                    </p>
                    {s.url && (
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-block truncate text-xs text-cyan-400 hover:underline"
                      >
                        {s.url}
                      </a>
                    )}
                    <p className="mt-1.5 text-[11px] text-muted-foreground/60">
                      {s.addedByName} ·{" "}
                      {formatDistanceToNow(new Date(s.createdAt), { addSuffix: true, locale: es })}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="mt-6">
          <AddContextSourceForm projectId={id} />
        </div>
      </div>
    </div>
  );
}
