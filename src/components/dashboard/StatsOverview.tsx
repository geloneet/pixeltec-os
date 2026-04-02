'use client';

import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { motion } from 'framer-motion';
import {
  DollarSign,
  CalendarClock,
  Rocket,
  AlertTriangle,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { cardVariants, staggerContainer } from '@/lib/animations';

// --- Interfaces & Types ---
interface FinanceTransaction {
    id: string;
    amount: number;
    date: any;
    status: 'Pagado' | 'Pendiente';
}

interface Lead {
  id: string;
  stage: string;
  estimatedValue: number;
}

interface Ticket {
  id: string;
  estado: 'Abierto' | 'En proceso' | 'Esperando cliente' | 'Resuelto';
  prioridad: 'Baja' | 'Media' | 'Alta';
}

interface Stats {
    incomeThisMonth: number;
    pendingRevenue: number;
    pipelineValue: number;
    criticalTickets: number;
}


const KpiCard = ({ title, value, icon, change, index, valueColor }: { title: string; value: string; icon: React.ReactNode; change: string; index: number, valueColor?: string }) => (
    <motion.div
        variants={cardVariants}
        custom={index}
        className="bg-black rounded-[2rem] border border-white/5 p-6 shadow-2xl flex flex-col justify-between"
    >
        <div>
            <div className="flex items-center justify-between text-zinc-400 mb-2">
                <p className="text-base font-medium">{title}</p>
                {icon}
            </div>
            <p className={cn("text-4xl font-semibold text-white", valueColor)}>{value}</p>
        </div>
        <p className="text-xs text-zinc-500 mt-4">{change}</p>
    </motion.div>
);

const SkeletonCard = () => (
    <div className="bg-black rounded-[2rem] border border-white/5 p-6 h-[152px] animate-pulse">
        <div className="h-4 bg-zinc-700 rounded w-3/4 mb-4"></div>
        <div className="h-10 bg-zinc-700 rounded w-1/2"></div>
        <div className="h-3 bg-zinc-700 rounded w-full mt-6"></div>
    </div>
);

export default function StatsOverview() {
    const firestore = useFirestore();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<Stats>({
        incomeThisMonth: 0,
        pendingRevenue: 0,
        pipelineValue: 0,
        criticalTickets: 0,
    });
    const [hasLoaded, setHasLoaded] = useState({ finances: false, leads: false, tickets: false });

    useEffect(() => {
        if (!firestore) return;

        const allLoaded = (currentStatus: typeof hasLoaded) => Object.values(currentStatus).every(Boolean);

        const unsubscribeFinances = onSnapshot(query(collection(firestore, 'finances')), (snapshot) => {
            const transactions = snapshot.docs.map(doc => doc.data() as FinanceTransaction);
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();

            const incomeThisMonth = transactions
                .filter(t => t.status === 'Pagado' && t.date?.toDate().getMonth() === currentMonth && t.date?.toDate().getFullYear() === currentYear)
                .reduce((sum, t) => sum + t.amount, 0);

            const pendingRevenue = transactions
                .filter(t => t.status === 'Pendiente')
                .reduce((sum, t) => sum + t.amount, 0);
            
            setStats(prev => ({...prev, incomeThisMonth, pendingRevenue}));
            setHasLoaded(prev => {
                const newStatus = {...prev, finances: true };
                if(allLoaded(newStatus)) setLoading(false);
                return newStatus;
            });
        }, (error) => {
            console.error("Error fetching finances: ", error);
            setHasLoaded(prev => {
                const newStatus = {...prev, finances: true };
                if(allLoaded(newStatus)) setLoading(false);
                return newStatus;
            });
        });

        const unsubscribeLeads = onSnapshot(query(collection(firestore, 'leads')), (snapshot) => {
            const leads = snapshot.docs.map(doc => doc.data() as Lead);
            const pipelineValue = leads.filter(l => l.stage !== 'Perdido').reduce((sum, lead) => sum + (lead.estimatedValue || 0), 0);
            setStats(prev => ({...prev, pipelineValue}));
            setHasLoaded(prev => {
                const newStatus = {...prev, leads: true };
                if(allLoaded(newStatus)) setLoading(false);
                return newStatus;
            });
        }, (error) => {
            console.error("Error fetching leads: ", error);
            setHasLoaded(prev => {
                const newStatus = {...prev, leads: true };
                if(allLoaded(newStatus)) setLoading(false);
                return newStatus;
            });
        });

        const unsubscribeTickets = onSnapshot(query(collection(firestore, 'tickets'), where('estado', '==', 'Abierto'), where('prioridad', '==', 'Alta')), (snapshot) => {
            setStats(prev => ({...prev, criticalTickets: snapshot.size}));
            setHasLoaded(prev => {
                const newStatus = {...prev, tickets: true };
                if(allLoaded(newStatus)) setLoading(false);
                return newStatus;
            });
        }, (error) => {
            console.error("Error fetching tickets: ", error);
            setHasLoaded(prev => {
                const newStatus = {...prev, tickets: true };
                if(allLoaded(newStatus)) setLoading(false);
                return newStatus;
            });
        });
        
        return () => {
            unsubscribeFinances();
            unsubscribeLeads();
            unsubscribeTickets();
        };
    }, [firestore]);
    
    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
            </div>
        );
    }

    return (
        <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
        >
            <KpiCard
                title="💰 Ingresos Mes"
                value={formatCurrency(stats.incomeThisMonth)}
                icon={<DollarSign className="text-lime-400" />}
                change="Total pagado en el mes actual"
                index={0}
                valueColor="text-lime-400"
            />
            <KpiCard
                title="⏳ Pendiente Cobro"
                value={formatCurrency(stats.pendingRevenue)}
                icon={<CalendarClock className="text-yellow-400" />}
                change="Total de facturas pendientes"
                index={1}
                valueColor="text-yellow-400"
            />
            <KpiCard
                title="🚀 Valor Pipeline"
                value={formatCurrency(stats.pipelineValue)}
                icon={<Rocket className="text-cyan-400" />}
                change="Suma de leads abiertos"
                index={2}
            />
            <KpiCard
                title="🚨 Soporte Crítico"
                value={stats.criticalTickets.toString()}
                icon={<AlertTriangle className="text-red-500" />}
                change="Tickets abiertos de alta prioridad"
                index={3}
                valueColor={stats.criticalTickets > 0 ? 'text-red-500' : 'text-white'}
            />
        </motion.div>
    );
}