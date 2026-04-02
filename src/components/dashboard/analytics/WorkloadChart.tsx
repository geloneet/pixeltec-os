'use client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface WorkloadChartProps {
    data: { name: string; pending: number }[];
}

export default function WorkloadChart({ data }: WorkloadChartProps) {
    return (
        <div className="lg:col-span-3 bg-black rounded-[2rem] border border-white/5 p-6 shadow-2xl h-[400px]">
            <h2 className="text-base font-medium text-zinc-400 mb-4">Carga de Trabajo por Cliente (Tareas Pendientes)</h2>
            <ResponsiveContainer width="100%" height="90%">
              <BarChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false}/>
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip 
                    cursor={{fill: 'rgba(255, 255, 255, 0.05)'}}
                    contentStyle={{ 
                        backgroundColor: '#1a1a1a', 
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '1rem'
                    }} 
                />
                <Bar dataKey="pending" name="Pendientes" fill="url(#colorPending)" radius={[4, 4, 0, 0]} />
                 <defs>
                  <linearGradient id="colorPending" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#a3e635" stopOpacity={0.4}/>
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
