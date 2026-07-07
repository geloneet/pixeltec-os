'use client';

import React, { useEffect, useRef, useState } from 'react';
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
  const [error, setError] = useState<string | null>(null);
  const firestore = useFirestore();
  // Generation counter: guards against out-of-order snapshots (a slow snapshot resolving
  // after a newer one has already landed) and against setState after unmount, since the
  // callback below is async (N+1 getDocs per client) and can outlive its subscription.
  const genRef = useRef(0);

  useEffect(() => {
    if (!firestore) return;
    const myGen = ++genRef.current;

    // Escuchamos la colección de clientes
    const unsubscribe = onSnapshot(
      collection(firestore, 'clients'),
      async (snapshot) => {
        try {
          const chartData: ChartData[] = [];

          // Nota: se mantiene el N+1 (una query de tareas por cliente) porque son
          // sub-colecciones independientes sin un contador de pendientes desnormalizado en el
          // doc del cliente; batchear implicaría ese cambio de modelo de datos, fuera de alcance
          // de este fix. Se prioriza cortar el race condition y el error callback.
          for (const clientDoc of snapshot.docs) {
            const clientData = clientDoc.data();

            const tasksQuery = query(collection(firestore, `clients/${clientDoc.id}/tasks`));
            const tasksSnapshot = await getDocs(tasksQuery);

            // Otra suscripción más reciente (o el desmontaje) invalidó este generation — abortar.
            if (genRef.current !== myGen) return;

            const pendingCount = tasksSnapshot.docs.filter(t => !t.data().completed).length;

            chartData.push({
              name: clientData.companyName || 'Sin Nombre',
              pendingTasks: pendingCount,
            });
          }

          if (genRef.current !== myGen) return;
          // Ordenamos para que la empresa con más carga aparezca primero
          setData(chartData.sort((a, b) => b.pendingTasks - a.pendingTasks));
          setError(null);
          setLoading(false);
        } catch (err) {
          if (genRef.current !== myGen) return;
          console.error('[WorkloadChart] Error procesando snapshot:', err);
          setError('No se pudo calcular la carga de trabajo.');
          setLoading(false);
        }
      },
      (err) => {
        if (genRef.current !== myGen) return;
        console.error('[WorkloadChart] Error en onSnapshot:', err);
        setError('No se pudo cargar la carga de trabajo.');
        setLoading(false);
      }
    );

    return () => {
      // Invalida cualquier trabajo async en vuelo ligado a esta suscripción.
      genRef.current++;
      unsubscribe();
    };
  }, [firestore]);

  if (loading) {
    return (
      <div className="h-[300px] flex items-center justify-center text-zinc-500 animate-pulse">
        Calculando carga de trabajo...
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[300px] flex items-center justify-center text-red-400 text-sm text-center px-4">
        {error}
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
