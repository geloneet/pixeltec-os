'use client';

import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { LoaderCircle, Plus, LifeBuoy } from 'lucide-react';
import SupportTicketBoard from '@/components/dashboard/support/SupportTicketBoard';
import AddTicketModal from '@/components/dashboard/support/AddTicketModal';
import { Button } from '@/components/ui/button';
import TicketDetailDrawer from '@/components/dashboard/support/TicketDetailDrawer';
import PageHeader from '@/components/dashboard/PageHeader';

// --- Interfaces ---
export interface Ticket {
  id: string;
  ticketId: string;
  cliente: string;
  problema: string;
  categoría: 'Hosting' | 'Página web' | 'Correo' | 'Automatización' | 'Hardware' | 'Otro';
  prioridad: 'Baja' | 'Media' | 'Alta';
  estado: 'Abierto' | 'En proceso' | 'Esperando cliente' | 'Resuelto';
  createdAt: any;
  fechaCierre?: any;
  solucionAplicada?: string;
}

// --- Main Page Component ---
export default function SupportPage() {
    const firestore = useFirestore();
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [defaultState, setDefaultState] = useState<string | undefined>();
    const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

    useEffect(() => {
        if (!firestore) return;
        setLoading(true);
        const ticketsQuery = query(collection(firestore, 'tickets'), orderBy('createdAt', 'desc'));
        
        const unsubscribe = onSnapshot(ticketsQuery, (snapshot) => {
            const ticketsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ticket));
            setTickets(ticketsData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching tickets: ", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [firestore]);

    const handleOpenModal = (estado?: string) => {
        setDefaultState(estado);
        setIsModalOpen(true);
    }

    const handleCloseDrawer = () => {
        setSelectedTicketId(null);
    }

    if (loading) {
      return (
        <div className="flex h-full items-center justify-center text-zinc-400">
          <LoaderCircle className="h-8 w-8 animate-spin mr-4" />
          Cargando tickets de soporte...
        </div>
      );
    }
    
    return (
        <main className="text-zinc-100 flex flex-col gap-6 h-full">
            <PageHeader
                title="Soporte Técnico"
                icon={<LifeBuoy size={36} />}
                action={
                    <Button onClick={() => handleOpenModal()} className="bg-white/5 hover:bg-white/10 text-white border border-white/10">
                        <Plus className="mr-2 h-5 w-5" />Nuevo Ticket
                    </Button>
                }
            />
            <div className="flex-1 overflow-x-auto">
                 <SupportTicketBoard tickets={tickets} onAddTicket={handleOpenModal} onTicketClick={setSelectedTicketId} />
            </div>
            <AddTicketModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} defaultState={defaultState} />
            {selectedTicketId && (
                <TicketDetailDrawer
                    isOpen={!!selectedTicketId}
                    onClose={handleCloseDrawer}
                    ticketId={selectedTicketId}
                />
            )}
        </main>
    );
}

    