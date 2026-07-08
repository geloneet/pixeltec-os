import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { resolveToken } from "@/lib/portal/token";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getFullCrmData } from "@/lib/db/repos/crm-sync";
import { getAdminFirestore } from "@/lib/firebase-admin";
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

  // Fetch strategy (aún en Firestore — módulo Documentos, fuera del alcance
  // de esta fase; hoy sin datos reales, colección vacía)
  const adminDb = getAdminFirestore();
  const stratSnap = await adminDb
    .collection("strategies")
    .where("uid", "==", uid)
    .where("clientId", "==", clientId)
    .limit(1)
    .get();
  const strategy: Strategy | null = stratSnap.empty
    ? null
    : ({ id: stratSnap.docs[0].id, ...stratSnap.docs[0].data() } as Strategy);

  // Active project = first project (or could be latest)
  const project = client.projects[0] ?? null;

  // Fetch signed contracts (aún en Firestore — módulo Documentos, fuera del
  // alcance de esta fase; hoy sin datos reales, colección vacía)
  const contractsSnap = await adminDb
    .collection("contracts")
    .where("uid", "==", uid)
    .where("clientId", "==", clientId)
    .where("status", "==", "firmado")
    .get();
  const signedContracts: Contract[] = contractsSnap.docs.map(
    d => ({ id: d.id, ...d.data() } as Contract),
  );

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
