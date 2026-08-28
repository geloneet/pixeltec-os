import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSessionUserId } from "@/lib/auth/session";
import { getProject } from "@/lib/projects/queries";
import PageHeader from "@/components/dashboard/PageHeader";
import { ProjectWorkForm } from "./project-work-form";

export const metadata: Metadata = {
  title: "Proyecto — PixelTEC OS",
};

export default async function ProyectoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ownerId = await getSessionUserId();
  const { id } = await params;
  if (!ownerId) redirect(`/login?redirect=/proyectos/${id}`);

  const proyecto = await getProject(id);
  if (!proyecto) notFound();

  return (
    <div className="mx-auto w-full max-w-[800px] px-4 py-8">
      <Link
        href="/proyectos"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Trabajo
      </Link>
      <PageHeader title={proyecto.name} description={proyecto.clientName} />
      <ProjectWorkForm project={proyecto} />
    </div>
  );
}
