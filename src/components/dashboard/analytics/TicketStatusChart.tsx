'use client';

import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';
import { LoaderCircle, Lock } from 'lucide-react';
import type { Ticket } from '@/app/dashboard/support/page';

interface ChartData {
  name: string;
  value: number;
}

const COLORS = {
  'Resuelto': '#84cc16', // lime-500
  'Abierto': '#ef4444', // red-500
  'En proceso': '#06b6d4', // cyan-500
  'Esperando cliente': '#eab308' // yellow-500
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-3 shadow-lg">
        <p className="font-bold text-white">{`${payload[0].name}: ${payload[0].value}`}</p>
      </div>
    );
  }
  return null;
};

const ErrorDisplay = ({ message }: { message: string }) => (
    <div className="h-full flex flex-col items-center justify-center text-center text-zinc-400 p-4 gap-4">
        <Lock className="h-8 w-8 text-yellow-400" />
        <p className="text-sm">{message}</p>
    </div>
);


export default function TicketStatusChart() {
    const firestore = useFirestore();
    const [chartData, setChartData] = useState<ChartData[]>([]);
    const [totalTickets, setTotalTickets] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!firestore) return;
        
        setLoading(true);
        setError(null);
        const ticketsQuery = query(collection(firestore, 'tickets'));

        const unsubscribe = onSnapshot(ticketsQuery, (snapshot) => {
            const tickets = snapshot.docs.map(doc => doc.data() as Ticket);
            
            const statusCounts = tickets.reduce((acc, ticket) => {
                const status = ticket.estado || 'Abierto';
                acc[status] = (acc[status] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            const formattedData = Object.entries(statusCounts).map(([name, value]) => ({
                name,
                value
            }));

            setChartData(formattedData);
            setTotalTickets(tickets.length);
            setLoading(false);
        }, (err: any) => {
            console.error("Error fetching ticket data: ", err);
            if (err.code === 'permission-denied') {
                setError("Sesión expirada o permisos insuficientes. Por favor, inicia sesión de nuevo.");
            } else {
                setError("No se pudieron cargar los datos de tickets.");
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [firestore]);

    if (loading) {
        return (
            <div className="bg-black rounded-[2rem] border border-white/5 p-6 shadow-2xl h-[400px] flex items-center justify-center text-zinc-500">
                <LoaderCircle className="animate-spin h-6 w-6 mr-2" />
                Cargando estado de tickets...
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-black rounded-[2rem] border border-white/5 p-6 shadow-2xl h-[400px]">
                <ErrorDisplay message={error} />
            </div>
        )
    }

    return (
        <div className="bg-black rounded-[2rem] border border-white/5 p-6 shadow-2xl h-[400px]">
            <h2 className="text-base font-medium text-zinc-400 mb-4">Distribución de Tickets de Soporte</h2>
            <ResponsiveContainer width="100%" height="90%">
                <PieChart>
                    <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        innerRadius={60}
                        outerRadius={80}
                        fill="#8884d8"
                        paddingAngle={5}
                        dataKey="value"
                    >
                        {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[entry.name as keyof typeof COLORS] || '#8884d8'} />
                        ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" />
                     <text
                        x="50%"
                        y="50%"
                        textAnchor="middle"
                        dominantBaseline="central"
                        className="text-4xl font-bold fill-white"
                    >
                        {totalTickets}
                    </text>
                     <text
                        x="50%"
                        y="50%"
                        dy={25}
                        textAnchor="middle"
                        dominantBaseline="central"
                        className="text-sm font-medium fill-zinc-400"
                    >
                        Total
                    </text>
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
}
