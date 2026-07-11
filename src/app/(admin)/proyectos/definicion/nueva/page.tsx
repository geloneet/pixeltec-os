import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { NewDefinitionForm } from "@/components/definition/NewDefinitionForm";

export const metadata: Metadata = {
  title: "Nuevo Proyecto — PixelTEC OS",
};

export default async function NuevaDefinicionPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; name?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { client, name } = await searchParams;
  if (!client) redirect("/proyectos/definicion");

  return <NewDefinitionForm clientCrmId={client} clientName={name ?? "Cliente"} />;
}
