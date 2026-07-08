import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { resolveToken } from "@/lib/portal/token";
import { db } from "@/lib/db";
import { clients as clientsTable, contracts, strategies, users } from "@/lib/db/schema";
import { getFullCrmData } from "@/lib/db/repos/crm-sync";
import { getPortalRequests } from "@/lib/portal/requests";
import PortalDashboard from "@/components/portal/PortalDashboard";
import PortalProyecto from "@/components/portal/PortalProyecto";
import PortalDocumentos from "@/components/portal/PortalDocumentos";
import PortalSolicitudes from "@/components/portal/PortalSolicitudes";
import type { CRMClient } from "@/types/crm";
import type { Contract, Strategy } from "@/types/documents";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function PortalTokenPage({ params }: PageProps) {
  const { token } = await params;

  // Resolve token → uid + clientId
  const resolved = await resolveToken(token);
  if (!resolved) notFound();
  const { uid, clientId } = resolved;

  // Fetch CRM data (Fase 4 — Postgres, ya no el blob crm_data de Firestore)
  const [ownerUser] = await db.select({ id: users.id }).from(users).where(eq(users.firebaseUid, uid)).limit(1);
  if (!ownerUser) notFound();
  const crmData = await getFullCrmData(ownerUser.id);
  const clients = crmData.clients as CRMClient[];
  const client = clients.find(c => c.id === clientId);
  if (!client || !client.portalEnabled) notFound();

  // clientId (de resolveToken) es el id original de Firestore — resolver el
  // uuid real de Postgres para las FK de contracts/strategies.
  const [clientRow] = await db
    .select({ id: clientsTable.id })
    .from(clientsTable)
    .where(eq(clientsTable.firestoreId, clientId))
    .limit(1);

  const strategyRow = clientRow
    ? (await db.select().from(strategies).where(eq(strategies.clientId, clientRow.id)).limit(1))[0]
    : undefined;
  const strategy: Strategy | null = strategyRow
    ? {
        id: strategyRow.id,
        uid,
        clientId,
        objectives: strategyRow.objectives as Strategy["objectives"],
        kpis: strategyRow.kpis as Strategy["kpis"],
        roadmap: strategyRow.roadmap as Strategy["roadmap"],
        priorities: strategyRow.priorities,
        channels: strategyRow.channels,
        automations: strategyRow.automations,
        lastUpdated: strategyRow.lastUpdated.toISOString(),
      }
    : null;

  // Active project = first project (or could be latest)
  const project = client.projects[0] ?? null;

  const contractRows = clientRow
    ? await db
        .select()
        .from(contracts)
        .where(and(eq(contracts.clientId, clientRow.id), eq(contracts.status, "firmado")))
    : [];
  const signedContracts: Contract[] = contractRows.map((row) => ({
    id: row.id,
    uid,
    clientId,
    proposalId: row.proposalId ?? undefined,
    templateId: row.templateId ?? undefined,
    version: row.version,
    status: row.status,
    title: row.title,
    content: row.content,
    variables: row.variables as Record<string, string>,
    signers: row.signers as Contract["signers"],
    pdfUrl: row.pdfUrl ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));

  // Fetch portal requests
  const portalRequests = await getPortalRequests(uid, clientId);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">{client.name}</h1>
        <p className="text-zinc-400 text-sm mt-1">Portal de seguimiento</p>
      </div>

      <PortalDashboard project={project} strategy={strategy} />
      <PortalProyecto project={project} />
      <PortalDocumentos contracts={signedContracts} token={token} />
      <PortalSolicitudes token={token} initialRequests={portalRequests} />
    </div>
  );
}
