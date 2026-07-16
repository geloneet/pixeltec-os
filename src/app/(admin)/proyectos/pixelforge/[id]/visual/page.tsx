import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { getPixelforgeProject } from "@/lib/db/repos/pixelforge";
import { StationPlaceholder } from "@/components/pixelforge/StationPlaceholder";

export default async function PixelforgeVisualPage({
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

  return <StationPlaceholder station="visual" />;
}
