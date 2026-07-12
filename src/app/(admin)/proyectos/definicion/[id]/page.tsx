import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { getClientById } from "@/lib/db/repos/crm";
import { getDefinitionFull } from "@/lib/db/repos/definitions";
import { DefinitionWorkspace } from "@/components/definition/DefinitionWorkspace";
import { DraftEditor } from "@/components/definition/DraftEditor";
import { STATION_SEQUENCE } from "@/lib/definition/types";
import type { DefinitionStation } from "@/lib/definition/types";
import type {
  DefinitionViewModel,
  WsStation,
  WsEvent,
} from "@/components/definition/view-model";
import type { ThreadMessage } from "@/components/definition/StationThread";

export const metadata: Metadata = {
  title: "Definición de proyecto — PixelTEC OS",
};

export default async function DefinicionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const ownerId = session?.user?.id;
  if (!ownerId) redirect("/login");

  const { id } = await params;
  const full = await getDefinitionFull(id, ownerId);
  if (!full) notFound();

  const client = await getClientById(full.definition.clientId, ownerId);

  const stations: WsStation[] = full.stations.map((s) => ({
    station: s.station,
    status: s.status,
    currentDraft: s.currentDraft,
    sealedContent: s.sealedContent,
    sealedAt: s.sealedAt ? s.sealedAt.toISOString() : null,
    sealedByName: s.sealedByName,
    reopenCount: s.reopenCount,
  }));

  const messagesByStation = Object.fromEntries(
    STATION_SEQUENCE.map((station) => [
      station,
      full.messages
        .filter((m) => m.station === station)
        .map((m): ThreadMessage => ({ id: m.id, role: m.role, content: m.content })),
    ])
  ) as Record<DefinitionStation, ThreadMessage[]>;

  const events: WsEvent[] = full.events.map((e) => ({
    id: e.id,
    type: e.type,
    station: e.station,
    actorName: e.actorName,
    reason: e.reason,
    createdAt: e.createdAt.toISOString(),
  }));

  const data: DefinitionViewModel = {
    id: full.definition.id,
    title: full.definition.title,
    brainDump: full.definition.brainDump,
    clientName: client?.name ?? "Cliente",
    clientCrmId: full.definition.clientCrmId,
    currentStation: full.definition.currentStation,
    status: full.definition.status,
    convertedProjectCrmId: full.definition.convertedProjectCrmId,
    stations,
    messagesByStation,
    events,
  };

  if (data.status === "draft") {
    return <DraftEditor data={data} />;
  }

  return <DefinitionWorkspace data={data} />;
}
