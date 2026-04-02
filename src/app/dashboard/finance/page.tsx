'use client';

import { useState, useEffect, useMemo } from 'react';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { Plus, LoaderCircle, DollarSign, Banknote, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn, formatCurrency } from '@/lib/utils';
import { cardVariants, staggerContainer } from '@/lib/animations';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import AddTransactionModal from '@/components/dashboard/finance/AddTransactionModal';
import PageHeader from '@/components/dashboard/PageHeader';
import { generateReceiptPDF } from '@/utils/generateReceiptPDF';
import { createActivityLog } from '@/utils/createLog';
import { sendPaymentEmailAction } from '@/app/actions';

// --- Interfaces & Types ---
interface FinanceTransaction {
    id: string;
    clientName: string;
    projectName: string;
    amount: number;
    type: 'Mensual' | 'Único';
    date: any; // Firestore Timestamp
    status: 'Pagado' | 'Pendiente';
    method: 'Transferencia' | 'Efectivo' | 'Stripe' | 'MercadoPago';
}



// --- KPI Card Component ---
const FinanceStatsCard = ({ title, value, icon, index }: { title: string; value: number; icon: React.ReactNode; index: number }) => (
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
            <p className="text-4xl font-semibold text-white">{formatCurrency(value)}</p>
        </div>
    </motion.div>
);


// --- Main Finance Page Component ---
export default function FinancePage() {
    const firestore = useFirestore();
    const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        if (!firestore) return;
        setLoading(true);
        const transQuery = query(collection(firestore, 'finances'), orderBy('date', 'desc'));
        
        const unsubscribe = onSnapshot(transQuery, (snapshot) => {
            const transData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FinanceTransaction));
            setTransactions(transData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching transactions: ", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [firestore]);

    const stats = useMemo(() => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const monthlyIncome = transactions
            .filter(t => t.status === 'Pagado' && t.date?.toDate().getMonth() === currentMonth && t.date?.toDate().getFullYear() === currentYear)
            .reduce((sum, t) => sum + t.amount, 0);

        const pendingPayments = transactions
            .filter(t => t.status === 'Pendiente')
            .reduce((sum, t) => sum + t.amount, 0);
        
        // MRR = transacciones de tipo Mensual, pagadas, en el mes actual
        const mrr = transactions
            .filter(t =>
                t.type === 'Mensual' &&
                t.status === 'Pagado' &&
                t.date?.toDate().getMonth() === currentMonth &&
                t.date?.toDate().getFullYear() === currentYear
            )
            .reduce((sum, t) => sum + t.amount, 0);
        
        return { monthlyIncome, pendingPayments, mrr };
    }, [transactions]);
    
    const handleToggleStatus = async (id: string, currentStatus: 'Pagado' | 'Pendiente') => {
        if (!firestore) return;
        const transactionRef = doc(firestore, 'finances', id);
        const newStatus = currentStatus === 'Pendiente' ? 'Pagado' : 'Pendiente';
        try {
            await updateDoc(transactionRef, { status: newStatus });
             if (newStatus === 'Pagado') {
                const transaction = transactions.find(t => t.id === id);
                if (transaction) {
                    await createActivityLog(firestore, {
                        type: 'finance',
                        message: `Se registró un pago de ${formatCurrency(transaction.amount)} de ${transaction.clientName}.`,
                        link: `/dashboard/finance`
                    });
                    // Fire payment notification email — non-blocking
                    sendPaymentEmailAction({
                        clientName:  transaction.clientName,
                        projectName: transaction.projectName,
                        amount:      transaction.amount,
                        method:      transaction.method,
                        type:        transaction.type,
                        date:        transaction.date
                            ? format(transaction.date.toDate(), "d 'de' MMMM, yyyy", { locale: es })
                            : new Date().toLocaleDateString('es-MX'),
                    }).catch(console.error);
                }
            }
        } catch (error) {
            console.error("Error updating transaction status: ", error);
        }
    };

    return (
        <main className="text-zinc-100 flex flex-col gap-6 h-full">
            <PageHeader
                title="Finanzas"
                icon={<Banknote size={36} />}
                action={
                    <Button onClick={() => setIsModalOpen(true)} className="bg-white/5 hover:bg-white/10 text-white border border-white/10">
                        <Plus className="mr-2 h-5 w-5" />Registrar Ingreso
                    </Button>
                }
            />

            <motion.div
                className="grid grid-cols-1 md:grid-cols-3 gap-6"
                initial="hidden"
                animate="visible"
                variants={staggerContainer}
            >
                <FinanceStatsCard title="Ingresos del Mes" value={stats.monthlyIncome} icon={<DollarSign className="text-lime-400" />} index={0} />
                <FinanceStatsCard title="Pagos Pendientes" value={stats.pendingPayments} icon={<CalendarClock className="text-yellow-400" />} index={1} />
                <FinanceStatsCard title="MRR (Mes Actual)" value={stats.mrr} icon={<Banknote className="text-cyan-400" />} index={2} />
            </motion.div>

            <div className="bg-black rounded-[2rem] border border-white/5 overflow-hidden shadow-2xl mt-4">
                {loading ? (
                    <div className="flex items-center justify-center h-96 text-zinc-500">
                        <LoaderCircle className="h-8 w-8 animate-spin mr-4" />
                        Cargando transacciones...
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow className="border-white/10 hover:bg-black">
                                <TableHead>Cliente</TableHead>
                                <TableHead>Proyecto</TableHead>
                                <TableHead>Monto</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead>Método</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {transactions.map((t) => (
                                <TableRow key={t.id} className="border-white/5">
                                    <TableCell className="font-medium text-white">{t.clientName}</TableCell>
                                    <TableCell className="text-zinc-400">{t.projectName}</TableCell>
                                    <TableCell className="font-mono text-lime-400">{formatCurrency(t.amount)}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={cn(
                                            'font-semibold',
                                            t.type === 'Mensual' ? 'bg-blue-900/50 text-blue-300 border-blue-500/30' : 'bg-purple-900/50 text-purple-300 border-purple-500/30'
                                        )}>
                                            {t.type}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{t.date ? format(t.date.toDate(), 'dd MMM, yyyy', { locale: es }) : 'N/A'}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={cn(
                                            'font-semibold cursor-pointer',
                                            t.status === 'Pagado' ? 'bg-green-900/50 text-green-400 border-green-500/30' : 'bg-yellow-900/50 text-yellow-400 border-yellow-500/30'
                                        )} onClick={() => handleToggleStatus(t.id, t.status)}>
                                            {t.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-zinc-400">{t.method}</TableCell>
                                    <TableCell className="text-right">
                                        {t.status === 'Pendiente' ? (
                                            <Button size="sm" variant="ghost" className="text-lime-400 hover:bg-lime-900/50 hover:text-lime-300" onClick={() => handleToggleStatus(t.id, t.status)}>
                                                Marcar Pagado
                                            </Button>
                                        ) : (
                                            <Button size="sm" variant="ghost" className="text-cyan-400 hover:bg-cyan-900/50 hover:text-cyan-300" onClick={() => generateReceiptPDF(t)}>
                                                📄 Recibo
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </div>
            
            <AddTransactionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </main>
    );
}
