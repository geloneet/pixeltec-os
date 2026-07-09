import { redirect } from 'next/navigation';
import { and, desc, eq } from 'drizzle-orm';
import {
  FolderKanban,
  FileText,
  LifeBuoy,
  FolderArchive,
  ExternalLink,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { db } from '@/lib/db';
import { clientPortalProjects, clients, finances, tickets } from '@/lib/db/schema';
import { readLegacyPortalSession } from '@/lib/portal/legacy-session';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// --- Interfaces ---
interface Project {
  id: string;
  name: string;
  status: string;
}

interface Finance {
  id: string;
  projectName: string | null;
  amount: string;
  date: Date;
  status: string;
}

interface Ticket {
  id: string;
  ticketId: string;
  problema: string;
  estado: string;
}

interface ClientDocument {
  name: string;
  url: string;
  category: string;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
  }).format(value);
};

const statusColors: { [key: string]: string } = {
  'En desarrollo': 'bg-blue-500/20 text-blue-400',
  'En revisión': 'bg-yellow-500/20 text-yellow-400',
  'Entregado': 'bg-green-500/20 text-green-400',
  'Planeación': 'bg-gray-500/20 text-gray-400',
  'Cancelado': 'bg-red-500/20 text-red-400',
  'Pagado': 'bg-green-900/50 text-green-400 border-green-500/30',
  'Pendiente': 'bg-yellow-900/50 text-yellow-400 border-yellow-500/30',
  'Abierto': 'bg-red-900/50 text-red-400 border-red-500/30',
  'En proceso': 'bg-cyan-900/50 text-cyan-400 border-cyan-500/30',
  'Esperando cliente': 'bg-orange-900/50 text-orange-400 border-orange-500/30',
  'Resuelto': 'bg-green-900/50 text-green-400 border-green-500/30',
};

// --- Card Component ---
const InfoCard = ({ icon, title, children }: { icon: React.ReactNode, title: string, children: React.ReactNode }) => (
  <div className="bg-black rounded-[2rem] border border-white/5 p-6 shadow-2xl flex flex-col">
    <div className="flex items-center gap-4 mb-4">
      {icon}
      <h2 className="text-xl font-semibold text-white">{title}</h2>
    </div>
    <div className="flex-1 space-y-3 overflow-y-auto pr-2 -mr-2">
      {children}
    </div>
  </div>
);

export default async function PortalOverviewPage() {
  const session = await readLegacyPortalSession();
  if (!session) redirect('/login?modo=cliente');

  const [client] = await db.select().from(clients).where(eq(clients.id, session.clientId)).limit(1);
  if (!client) {
    return (
      <div className="text-center py-20">
        <p className="text-xl text-red-400">No se encontró un portal de cliente asociado a esta cuenta.</p>
      </div>
    );
  }

  const projectRows = await db
    .select({ id: clientPortalProjects.id, name: clientPortalProjects.name, status: clientPortalProjects.status })
    .from(clientPortalProjects)
    .where(eq(clientPortalProjects.clientId, client.id))
    .orderBy(clientPortalProjects.name);

  const financeRows = await db
    .select({
      id: finances.id,
      projectName: finances.projectName,
      amount: finances.amount,
      date: finances.date,
      status: finances.status,
    })
    .from(finances)
    .where(eq(finances.clientName, client.name))
    .orderBy(desc(finances.date))
    .limit(5);

  const ticketRows = await db
    .select({ id: tickets.id, ticketId: tickets.ticketId, problema: tickets.problema, estado: tickets.estado })
    .from(tickets)
    .where(and(eq(tickets.cliente, client.name)))
    .orderBy(desc(tickets.createdAt))
    .limit(5);

  const projects: Project[] = projectRows;
  const financeList: Finance[] = financeRows;
  const ticketList: Ticket[] = ticketRows;
  const documents = (client.documents as ClientDocument[] | null) ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-bold tracking-tight text-white">Resumen del Portal</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Projects */}
        <InfoCard icon={<FolderKanban className="h-6 w-6 text-cyan-400" />} title="Estado de Proyectos">
          {projects.length > 0 ? projects.map(p => (
            <div key={p.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
              <p className="font-medium text-zinc-200">{p.name}</p>
              <Badge variant="outline" className={cn('font-semibold', statusColors[p.status])}>{p.status}</Badge>
            </div>
          )) : <p className="text-zinc-500 text-sm text-center py-4">No hay proyectos activos.</p>}
        </InfoCard>

        {/* Finances */}
        <InfoCard icon={<FileText className="h-6 w-6 text-lime-400" />} title="Últimas Facturas">
          {financeList.length > 0 ? financeList.map(f => (
            <div key={f.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
              <div>
                <p className="font-medium text-zinc-200">{f.projectName ?? '—'}</p>
                <p className="text-sm text-zinc-400">{format(f.date, 'dd MMM, yyyy', { locale: es })}</p>
              </div>
              <div className="text-right">
                <p className="font-mono font-bold text-lg text-lime-300">{formatCurrency(Number(f.amount))}</p>
                <Badge variant="outline" className={cn('font-semibold', statusColors[f.status])}>{f.status}</Badge>
              </div>
            </div>
          )) : <p className="text-zinc-500 text-sm text-center py-4">No hay registros de facturación.</p>}
        </InfoCard>

        {/* Support Tickets */}
        <InfoCard icon={<LifeBuoy className="h-6 w-6 text-red-400" />} title="Tickets de Soporte">
          {ticketList.length > 0 ? ticketList.map(t => (
            <div key={t.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
              <div className="max-w-[70%]">
                <p className="font-medium text-zinc-300 truncate">{t.problema}</p>
                <p className="text-xs text-zinc-500 font-mono">{t.ticketId}</p>
              </div>
              <Badge variant="outline" className={cn('font-semibold', statusColors[t.estado])}>{t.estado}</Badge>
            </div>
          )) : <p className="text-zinc-500 text-sm text-center py-4">No tienes tickets de soporte.</p>}
        </InfoCard>

        {/* Documents */}
        <InfoCard icon={<FolderArchive className="h-6 w-6 text-yellow-400" />} title="Archivos y Entregables">
          {documents.length > 0 ? documents.map((doc, i) => (
            <a key={i} href={doc.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors group">
              <div>
                <p className="font-medium text-zinc-200">{doc.name}</p>
                <p className="text-xs text-zinc-500">{doc.category}</p>
              </div>
              <ExternalLink className="h-5 w-5 text-zinc-500 group-hover:text-cyan-400 transition-colors" />
            </a>
          )) : <p className="text-zinc-500 text-sm text-center py-4">No hay documentos compartidos.</p>}
        </InfoCard>

      </div>
    </div>
  );
}
