'use client';

import React, { useEffect, useState } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from 'recharts';
import { collection, onSnapshot, getDocs, query } from 'firebase/firestore';
import { useFirestore } from '@/firebase';

interface ChartData {
  name: string;
  pendingTasks: number;
}

export default function WorkloadChart() {
  const [data, setData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const firestore = useFirestore();

  useEffect(() => {
    if (!firestore) return;
    // Escuchamos la colección de clientes
    const unsubscribe = onSnapshot(collection(firestore, 'clients'), async (snapshot) => {
      const chartData: ChartData[] = [];
      
      for (const clientDoc of snapshot.docs) {
        const clientData = clientDoc.data();
        
        // Consultamos las tareas pendientes de cada cliente (sub-colección)
        const tasksQuery = query(collection(firestore, `clients/${clientDoc.id}/tasks`));
        const tasksSnapshot = await getDocs(tasksQuery);
        
        // Filtramos solo las que no están completadas
        const pendingCount = tasksSnapshot.docs.filter(t => !t.data().completed).length;
        
        chartData.push({
          name: clientData.companyName || 'Sin Nombre',
          pendingTasks: pendingCount
        });
      }
      
      // Ordenamos para que la empresa con más carga aparezca primero
      setData(chartData.sort((a, b) => b.pendingTasks - a.pendingTasks));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [firestore]);

  if (loading) {
    return (
      <div className="h-[300px] flex items-center justify-center text-zinc-500 animate-pulse">
        Calculando carga de trabajo...
      </div>
    );
  }

  return (
    <div className="w-full h-[350px] p-4 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md">
      <h3 className="text-sm font-medium text-zinc-400 mb-6 uppercase tracking-wider">
        Tareas Pendientes por Empresa
      </h3>
      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity={1} />
              <stop offset="100%" stopColor="#84cc16" stopOpacity={1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
          <XAxis 
            dataKey="name" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#71717a', fontSize: 11 }}
            dy={10}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#71717a', fontSize: 11 }} 
          />
          <Tooltip 
            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
            contentStyle={{ 
              backgroundColor: '#09090b', 
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              fontSize: '12px'
            }}
            itemStyle={{ color: '#06b6d4' }}
          />
          <Bar 
            dataKey="pendingTasks" 
            radius={[6, 6, 0, 0]} 
            fill="url(#barGradient)"
            barSize={40}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
