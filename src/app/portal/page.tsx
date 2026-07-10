import { readPortalSessionClientId, clearPortalSessionCookie } from '@/lib/client-portal/cookie';
import { resolveClientPgId } from '@/lib/documents/pg';
import { getPortalDashboardData } from '@/lib/client-portal/pg';
import { PortalLoginClient } from './portal-login-client';
import { PortalDashboard } from './portal-dashboard';

export default async function PortalPage() {
  const publicClientId = await readPortalSessionClientId();

  if (publicClientId) {
    const clientPgId = await resolveClientPgId(publicClientId);
    const data = clientPgId ? await getPortalDashboardData(clientPgId) : null;
    if (data) return <PortalDashboard data={data} />;

    // Cookie válida pero el cliente ya no existe o el portal fue desactivado
    // — se limpia y se muestra el login, no un error.
    await clearPortalSessionCookie();
  }

  return <PortalLoginClient />;
}
