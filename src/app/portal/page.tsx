import { readPortalSessionClientId } from '@/lib/client-portal/cookie';
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

    // Cookie con firma válida pero el cliente ya no existe o el portal fue
    // desactivado: NO se puede limpiar la cookie aquí — Next.js prohíbe
    // mutar cookies desde el render de un Server Component (solo Server
    // Actions / Route Handlers pueden). No hace falta: getPortalDashboardData
    // y isPortalAccessEnabled (usado también en la descarga de contratos)
    // revalidan portalAccessEnabled en cada uso, así que una cookie vieja
    // sin acceso real no otorga nada — simplemente cae aquí y ve el login
    // en cada carga hasta que expire, se reactive el portal, o el cliente
    // cierre sesión explícitamente (logoutClientPortalAction sí puede
    // limpiar la cookie, porque es una Server Action real).
  }

  return <PortalLoginClient />;
}
