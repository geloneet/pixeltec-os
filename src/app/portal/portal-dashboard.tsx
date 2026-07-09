import { FolderKanban, FileText, LifeBuoy, FolderArchive, Megaphone } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { PortalDashboardData } from '@/lib/client-portal/pg';
import { LogoutButton } from './logout-button';

const statusColors: Record<string, string> = {
  'En desarrollo': 'bg-blue-500/20 text-blue-400',
  'En revisión': 'bg-yellow-500/20 text-yellow-400',
  'Entregado': 'bg-green-500/20 text-green-400',
  'Planeación': 'bg-gray-500/20 text-gray-400',
  'Cancelado': 'bg-red-500/20 text-red-400',
  'Activo': 'bg-cyan-500/20 text-cyan-400',
  'Pagado': 'bg-green-900/50 text-green-400 border-green-500/30',
  'Pendiente': 'bg-yellow-900/50 text-yellow-400 border-yellow-500/30',
  'Abierto': 'bg-red-900/50 text-red-400 border-red-500/30',
  'En proceso': 'bg-cyan-900/50 text-cyan-400 border-cyan-500/30',
  'Esperando cliente': 'bg-orange-900/50 text-orange-400 border-orange-500/30',
  'Resuelto': 'bg-green-900/50 text-green-400 border-green-500/30',
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(value);

function InfoCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-black rounded-[2rem] border border-white/5 p-6 shadow-2xl flex flex-col">
      <div className="flex items-center gap-4 mb-4">
        {icon}
        <h2 className="text-xl font-semibold text-white">{title}</h2>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto pr-2 -mr-2">{children}</div>
    </div>
  );
}

export function PortalDashboard({ data }: { data: PortalDashboardData }) {
  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-10 sm:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-white">Hola, {data.clientName}</h1>
            <p className="text-sm text-zinc-500 mt-1">Resumen de tu cuenta con PixelTEC</p>
          </div>
          <LogoutButton />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <InfoCard icon={<FolderKanban className="h-6 w-6 text-cyan-400" />} title="Estado de Proyectos">
            {data.projects.length > 0 ? (
              data.projects.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <p className="font-medium text-zinc-200">{p.name}</p>
                  <Badge variant="outline" className={cn('font-semibold', statusColors[p.status])}>{p.status}</Badge>
                </div>
              ))
            ) : (
              <p className="text-zinc-500 text-sm text-center py-4">No hay proyectos activos.</p>
            )}
          </InfoCard>

          <InfoCard icon={<FileText className="h-6 w-6 text-lime-400" />} title="Últimas Facturas">
            {data.invoices.length > 0 ? (
              data.invoices.map((f) => (
                <div key={f.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div>
                    <p className="font-medium text-zinc-200">{f.projectName ?? '—'}</p>
                    <p className="text-sm text-zinc-400">{format(new Date(f.date), 'dd MMM, yyyy', { locale: es })}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-lg text-lime-300">{formatCurrency(Number(f.amount))}</p>
                    <Badge variant="outline" className={cn('font-semibold', statusColors[f.status])}>{f.status}</Badge>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-zinc-500 text-sm text-center py-4">No hay registros de facturación.</p>
            )}
          </InfoCard>

          <InfoCard icon={<FolderArchive className="h-6 w-6 text-yellow-400" />} title="Documentos y Contratos">
            {data.contracts.length > 0 ? (
              data.contracts.map((c) => (
                <a
                  key={c.id}
                  href={`/api/portal/contract-pdf?contractId=${c.id}`}
                  className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <p className="font-medium text-zinc-200">
                    {c.title} <span className="text-zinc-500 text-xs">v{c.version}</span>
                  </p>
                  <Badge variant="outline" className="font-semibold bg-green-500/20 text-green-400">Firmado</Badge>
                </a>
              ))
            ) : (
              <p className="text-zinc-500 text-sm text-center py-4">No hay documentos compartidos.</p>
            )}
          </InfoCard>

          <InfoCard icon={<LifeBuoy className="h-6 w-6 text-red-400" />} title="Tickets de Soporte">
            {data.tickets.length > 0 ? (
              data.tickets.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div className="max-w-[70%]">
                    <p className="font-medium text-zinc-300 truncate">{t.problema}</p>
                    <p className="text-xs text-zinc-500 font-mono">{t.ticketId}</p>
                  </div>
                  <Badge variant="outline" className={cn('font-semibold', statusColors[t.estado])}>{t.estado}</Badge>
                </div>
              ))
            ) : (
              <p className="text-zinc-500 text-sm text-center py-4">No tienes tickets de soporte.</p>
            )}
          </InfoCard>

          <InfoCard icon={<Megaphone className="h-6 w-6 text-purple-400" />} title="Actualizaciones">
            {data.updates.length > 0 ? (
              data.updates.map((u) => (
                <div key={u.id} className="p-3 bg-white/5 rounded-lg">
                  {u.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={u.imageUrl} alt="" className="rounded-lg mb-2 w-full object-cover max-h-48" />
                  )}
                  <p className="text-sm text-zinc-200">{u.text}</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    {u.createdBy} · {format(new Date(u.createdAt), 'dd MMM, yyyy', { locale: es })}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-zinc-500 text-sm text-center py-4">Sin actualizaciones por ahora.</p>
            )}
          </InfoCard>
        </div>
      </div>
    </main>
  );
}
