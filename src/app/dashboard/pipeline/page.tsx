'use client';

import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { LoaderCircle, Plus } from 'lucide-react';
import SalesPipelineBoard from '@/components/dashboard/sales/SalesPipelineBoard';
import AddLeadModal from '@/components/dashboard/sales/AddLeadModal';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/dashboard/PageHeader';

// --- Interfaces ---
interface Lead {
  id: string;
  companyName: string;
  contactName: string;
  stage: 'Lead nuevo' | 'Contactado' | 'Reunión agendada' | 'Propuesta enviada' | 'Negociación' | 'Ganado' | 'Perdido';
  estimatedValue: number;
  closeProbability: number;
  interestedService: string;
}

// --- Main Page Component ---
export default function PipelinePage() {
    const firestore = useFirestore();
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [defaultStage, setDefaultStage] = useState<string | undefined>();

    useEffect(() => {
        if (!firestore) return;
        setLoading(true);
        const leadsQuery = query(collection(firestore, 'leads'), orderBy('companyName', 'asc'));
        
        const unsubscribe = onSnapshot(leadsQuery, (snapshot) => {
            const leadsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lead));
            setLeads(leadsData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching leads: ", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [firestore]);

    const handleOpenModal = (stage?: string) => {
        setDefaultStage(stage);
        setIsModalOpen(true);
    }

    if (loading) {
      return (
        <div className="flex h-full items-center justify-center text-zinc-400">
          <LoaderCircle className="h-8 w-8 animate-spin mr-4" />
          Cargando pipeline de ventas...
        </div>
      );
    }
    
    return (
        <main className="text-zinc-100 flex flex-col gap-6 h-full">
            <PageHeader
                title="Sales Pipeline"
                action={
                    <Button onClick={() => handleOpenModal()} className="bg-white/5 hover:bg-white/10 text-white border border-white/10">
                        <Plus className="mr-2 h-5 w-5" />Añadir Lead
                    </Button>
                }
            />
            <div className="flex-1 overflow-x-auto">
                 <SalesPipelineBoard leads={leads} onAddLead={handleOpenModal} />
            </div>
            <AddLeadModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} defaultStage={defaultStage} />
        </main>
    );
}
