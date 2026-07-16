import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { getClientsByOwner } from "@/lib/db/repos/crm";
import { listDefinitionsByOwner } from "@/lib/db/repos/definitions";
import {
  NewPixelforgeForm,
  type ClientOption,
  type DefinitionOption,
} from "@/components/pixelforge/NewPixelforgeForm";

export const metadata: Metadata = {
  title: "Nuevo proyecto PixelForge — PixelTEC OS",
};

export default async function NuevoPixelforgePage() {
  const session = await auth();
  const ownerId = session?.user?.id;
  if (!ownerId) redirect("/login?redirect=/proyectos/pixelforge/nueva");

  const [clientRows, definitionRows] = await Promise.all([
    getClientsByOwner(ownerId),
    listDefinitionsByOwner(ownerId),
  ]);

  const clients: ClientOption[] = clientRows
    .map((c) => ({ crmId: c.firestoreId ?? c.id, name: c.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const clientCrmIdByClientId = new Map(clientRows.map((c) => [c.id, c.firestoreId ?? c.id]));

  const definitions: DefinitionOption[] = definitionRows
    .filter((d) => d.status === "completed")
    .flatMap((d) => {
      const clientCrmId = clientCrmIdByClientId.get(d.clientId);
      if (!clientCrmId) return [];
      return [{ id: d.id, title: d.title, clientCrmId }];
    });

  // NewPixelforgeForm ya incluye su propio header ("Nuevo Proyecto PixelForge")
  // y el contenedor mx-auto — igual que NewDefinitionForm en /definicion/nueva.
  return <NewPixelforgeForm clients={clients} definitions={definitions} />;
}
