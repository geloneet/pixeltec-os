'use client';

import { useState, useEffect } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { collection, query, where, onSnapshot, doc, getDocs, limit, orderBy } from 'firebase/firestore';
import { motion } from 'framer-motion';
import {
  LoaderCircle,
  FolderKanban,
  FileText,
  LifeBuoy,
  FolderArchive,
  ExternalLink,
  Circle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// --- Interfaces ---
interface Project {
  id: string;
  name: string;
  status: 'Planeación' | 'En desarrollo' | 'En revisión' | 'Entregado' | 'Cancelado';
}

interface Finance {
  id: string;
  projectName: string;
  amount: number;
  date: any;
  status: 'Pagado' | 'Pendiente';
}

interface Ticket {
  id: string;
  ticketId: string;
  problema: string;
  estado: 'Abierto' | 'En proceso' | 'Esperando cliente' | 'Resuelto';
}

interface ClientDocument {
  name: string;
  url: string;
  category: string;
}

interface Client {
    id: string;
    companyName: string;
    documents?: ClientDocument[];
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
  'Resuelto': 'bg-green-900/50 text-green-400 border-green-500/30'
};


// --- Card Component ---
const InfoCard = ({ icon, title, children }: { icon: React.ReactNode, title: string, children: React.ReactNode }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-black rounded-[2rem] border border-white/5 p-6 shadow-2xl flex flex-col"
    >
        <div className="flex items-center gap-4 mb-4">
            {icon}
            <h2 className="text-xl font-semibold text-white">{title}</h2>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto pr-2 -mr-2">
            {children}
        </div>
    </motion.div>
);


export default function PortalOverviewPage() {
    const firestore = useFirestore();
    const user = useUser();

    const [client, setClient] = useState<Client | null>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [finances, setFinances] = useState<Finance[]>([]);
    const [tickets, setTickets] = useState<Ticket[]>([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!firestore || !user?.email) {
             if (!user) setLoading(false); // If user is null (logged out), stop loading.
             return;
        }

        setLoading(true);

        // 1. Find the client associated with the logged-in user's email
        const clientQuery = query(collection(firestore, 'clients'), where('contactEmail', '==', user.email), limit(1));
        const unsubscribeClient = onSnapshot(clientQuery, (snapshot) => {
            if (!snapshot.empty) {
                const clientDoc = snapshot.docs[0];
                const clientData = { id: clientDoc.id, ...clientDoc.data() } as Client;
                setClient(clientData);
                setError(null);
            } else {
                setLoading(false);
                setError("No se encontró un portal de cliente asociado a esta cuenta.");
                setClient(null);
            }
        }, (err) => {
            console.error("Error fetching client:", err);
            setError("No se pudo cargar la información del portal.");
            setLoading(false);
        });

        return () => unsubscribeClient();
    }, [firestore, user]);


    useEffect(() => {
        if (!firestore || !client) {
            if (!loading) {
                setProjects([]); 
                setFinances([]); 
                setTickets([]);
            }
            return;
        }

        setLoading(true);
        const unsubscribers: (() => void)[] = [];

        // 2. Fetch Projects
        const projectsQuery = query(collection(firestore, 'clients', client.id, 'projects'), orderBy('name', 'asc'));
        unsubscribers.push(onSnapshot(projectsQuery, (snapshot) => {
            setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project)));
        }));
        
        // 3. Fetch Finances
        const financesQuery = query(collection(firestore, 'finances'), where('clientName', '==', client.companyName), orderBy('date', 'desc'), limit(5));
        unsubscribers.push(onSnapshot(financesQuery, (snapshot) => {
            setFinances(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Finance)));
        }));

        // 4. Fetch Tickets
        const ticketsQuery = query(collection(firestore, 'tickets'), where('cliente', '==', client.companyName), orderBy('createdAt', 'desc'), limit(5));
        unsubscribers.push(onSnapshot(ticketsQuery, (snapshot) => {
            setTickets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ticket)));
        }));

        setLoading(false);
        return () => unsubscribers.forEach(unsub => unsub());

    }, [firestore, client, loading]);

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <LoaderCircle className="h-10 w-10 animate-spin text-cyan-400" />
            </div>
        );
    }
    
    if (error) {
        return (
             <div className="text-center py-20">
                <p className="text-xl text-red-400">{error}</p>
             </div>
        );
    }

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
                     {finances.length > 0 ? finances.map(f => (
                        <div key={f.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                           <div>
                                <p className="font-medium text-zinc-200">{f.projectName}</p>
                                <p className="text-sm text-zinc-400">{f.date ? format(f.date.toDate(), 'dd MMM, yyyy', { locale: es }) : ''}</p>
                           </div>
                           <div className="text-right">
                                <p className="font-mono font-bold text-lg text-lime-300">{formatCurrency(f.amount)}</p>
                                <Badge variant="outline" className={cn('font-semibold', statusColors[f.status])}>{f.status}</Badge>
                           </div>
                        </div>
                    )) : <p className="text-zinc-500 text-sm text-center py-4">No hay registros de facturación.</p>}
                </InfoCard>

                {/* Support Tickets */}
                <InfoCard icon={<LifeBuoy className="h-6 w-6 text-red-400" />} title="Tickets de Soporte">
                     {tickets.length > 0 ? tickets.map(t => (
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
                     {(client?.documents && client.documents.length > 0) ? client.documents.map((doc, i) => (
                        <a key={i} href={doc.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors group">
                           <div>
                                <p className="font-medium text-zinc-200">{doc.name}</p>
                                <p className="text-xs text-zinc-500">{doc.category}</p>
                           </div>
                           <ExternalLink className="h-5 w-5 text-zinc-500 group-hover:text-cyan-400 transition-colors"/>
                        </a>
                    )) : <p className="text-zinc-500 text-sm text-center py-4">No hay documentos compartidos.</p>}
                </InfoCard>

            </div>
        </div>
    );
}
