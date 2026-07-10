import { PortalAdminList } from '@/components/portal-admin/PortalAdminList';

export default function PortalAdminPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Portal de Clientes</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Activa el acceso al portal por cliente y publica actualizaciones. Todos los clientes, sin importar su origen.
        </p>
      </div>
      <PortalAdminList />
    </div>
  );
}
