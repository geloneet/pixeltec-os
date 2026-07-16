import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth/config";
import { getClientById } from "@/lib/db/repos/crm";
import { getPixelforgeProjectFull } from "@/lib/db/repos/pixelforge";
import { PixelforgeStatusBadge } from "@/components/pixelforge/PixelforgeStatusBadge";
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
          className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          PixelForge
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-foreground">{project.title}</h1>
          <PixelforgeStatusBadge status={project.status} currentStation={project.currentStation} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{client?.name ?? "Cliente"}</p>
      </header>

      <div className="sticky top-0 z-10 mt-6 border-b border-border bg-background/95 py-3 backdrop-blur">
        <StepperBar
          projectId={project.id}
          statuses={statuses}
          fallbackStation={project.currentStation}
          completed={completed}
        />
      </div>

      {children}
    </div>
  );
}
