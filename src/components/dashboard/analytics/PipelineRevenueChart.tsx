'use client';

import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { LoaderCircle, Lock } from 'lucide-react';

interface Lead {
  id: string;
  stage: string;
  estimatedValue: number;
}

interface ChartData {
  stage: string;
  value: number;
}

const PIPELINE_ORDER = [
  'Contactado',
  'Reunión agendada',
  'Propuesta enviada',
  'Negociación',
  'Ganado'
];

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-3 shadow-lg">
        <p className="font-bold text-white">{`${label}`}</p>
        <p className="text-cyan-400">{`Valor: ${formatCurrency(payload[0].value)}`}</p>
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


export default function PipelineRevenueChart() {
    const firestore = useFirestore();
    const [chartData, setChartData] = useState<ChartData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!firestore) return;
        
        setLoading(true);
        setError(null);
        const leadsQuery = query(collection(firestore, 'leads'));

        const unsubscribe = onSnapshot(leadsQuery, (snapshot) => {
            const leads = snapshot.docs.map(doc => doc.data() as Lead);
            
            const revenueByStage = leads.reduce((acc, lead) => {
                if (lead.stage && lead.estimatedValue) {
                    if (!acc[lead.stage]) {
                        acc[lead.stage] = 0;
                    }
                    acc[lead.stage] += lead.estimatedValue;
                }
                return acc;
            }, {} as Record<string, number>);

            const formattedData = PIPELINE_ORDER.map(stage => ({
                stage,
                value: revenueByStage[stage] || 0
            })).filter(item => item.value > 0);

            setChartData(formattedData);
            setLoading(false);
        }, (err: any) => {
            console.error("Error fetching pipeline data: ", err);
            if (err.code === 'permission-denied') {
                setError("Sesión expirada o permisos insuficientes. Por favor, inicia sesión de nuevo.");
            } else {
                setError("No se pudieron cargar los datos del pipeline.");
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [firestore]);

    if (loading) {
        return (
            <div className="bg-black rounded-[2rem] border border-white/5 p-6 shadow-2xl h-[400px] flex items-center justify-center text-zinc-500">
                <LoaderCircle className="animate-spin h-6 w-6 mr-2" />
                Cargando datos del pipeline...
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
            <h2 className="text-base font-medium text-zinc-400 mb-4">Valor del Pipeline por Etapa</h2>
            <ResponsiveContainer width="100%" height="90%">
                <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                    <defs>
                        <linearGradient id="revenueGradient" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="5%" stopColor="#a3e635" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#22d3ee" stopOpacity={0.8}/>
                        </linearGradient>
                    </defs>
                    <XAxis type="number" hide />
                    <YAxis 
                        type="category" 
                        dataKey="stage" 
                        stroke="#888888" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false}
                        width={110}
                    />
                    <Tooltip 
                        content={<CustomTooltip />}
                        cursor={{fill: 'rgba(255, 255, 255, 0.05)'}}
                    />
                    <Bar dataKey="value" fill="url(#revenueGradient)" radius={[0, 4, 4, 0]} barSize={25} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
