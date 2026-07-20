import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { auth } from "@/lib/auth/config";
import { getClientById } from "@/lib/db/repos/crm";
import { getPixelforgeProjectFull } from "@/lib/db/repos/pixelforge";
import { ForgeStationBadge } from "@/components/pixelforge/forge/ForgeStationBadge";
import { StationTransition } from "@/components/pixelforge/StationTransition";
import { StepperBar } from "@/components/pixelforge/StepperBar";
import { PIXELFORGE_STATION_SEQUENCE, STATION_ARTIFACT } from "@/lib/pixelforge/types";
import type { PixelforgeArtifactStatus, PixelforgeStation } from "@/lib/pixelforge/types";

export default async function PixelforgeProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const ownerId = session?.user?.id;
  if (!ownerId) redirect("/login?redirect=/proyectos/pixelforge");

  const { id } = await params;
  const full = await getPixelforgeProjectFull(id, ownerId);
  if (!full) notFound();

  const { project, artifacts } = full;
  const client = await getClientById(project.clientId, ownerId);

  const statuses: Record<PixelforgeStation, PixelforgeArtifactStatus> = Object.fromEntries(
    PIXELFORGE_STATION_SEQUENCE.map((station) => {
      const kind = STATION_ARTIFACT[station];
      if (!kind) return [station, "pending"];
      const artifact = artifacts.find((a) => a.kind === kind);
      return [station, artifact?.status ?? "pending"];
    })
  ) as Record<PixelforgeStation, PixelforgeArtifactStatus>;

  const completed = project.status === "completed" || project.status === "approved";

  return (
    <div>
      <header className="mx-auto w-full max-w-5xl px-4 pt-8">
        <Link
          href="/proyectos/pixelforge"
          className="mb-3 inline-flex items-center gap-1.5 text-xs text-pfx-text-muted transition-colors hover:text-pfx-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pfx-accent focus-visible:ring-offset-2 focus-visible:ring-offset-pfx-canvas"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          PixelForge
        </Link>
        <h1 className="text-2xl font-extrabold tracking-[-0.02em] text-pfx-text">
          {project.title}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-sm text-pfx-text-muted">{client?.name ?? "Cliente"}</span>
          <ForgeStationBadge status={project.status} currentStation={project.currentStation} />
          <span className="font-forge-mono text-[11px] uppercase tracking-wider text-pfx-text-muted">
            {formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true, locale: es })}
          </span>
        </div>
      </header>

      <div className="sticky top-0 z-10 mt-6 border-b border-pfx-border bg-pfx-canvas/95 py-3 backdrop-blur">
        <StepperBar
          projectId={project.id}
          statuses={statuses}
          fallbackStation={project.currentStation}
          completed={completed}
        />
      </div>

      <StationTransition>{children}</StationTransition>
    </div>
  );
}
