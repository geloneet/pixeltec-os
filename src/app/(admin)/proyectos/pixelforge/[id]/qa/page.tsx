import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { getPixelforgeProject } from "@/lib/db/repos/pixelforge";
import { StationPlaceholder } from "@/components/pixelforge/StationPlaceholder";

export const metadata: Metadata = {
  title: "QA — PixelForge — PixelTEC OS",
};

export default async function PixelforgeQaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const ownerId = session?.user?.id;
  if (!ownerId) redirect("/login?redirect=/proyectos/pixelforge");

  const { id } = await params;
  const project = await getPixelforgeProject(id, ownerId);
  if (!project) notFound();

  return <StationPlaceholder station="qa" />;
}
