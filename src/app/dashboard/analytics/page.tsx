'use client';

import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { collection, getDocs, query, limit, orderBy } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { LoaderCircle, AlertTriangle, Clock, ListTodo } from 'lucide-react';
import { differenceInDays, format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import AnalyticsCard from '@/components/dashboard/analytics/AnalyticsCard';
import WorkloadChart from '@/components/dashboard/analytics/WorkloadChart';
import PipelineRevenueChart from '@/components/dashboard/analytics/PipelineRevenueChart';
import TicketStatusChart from '@/components/dashboard/analytics/TicketStatusChart';
import AIPredictions from '@/components/dashboard/analytics/AIPredictions';
import ActivityHeatmap from '@/components/dashboard/analytics/ActivityHeatmap';


interface Client {
  id: string;
  companyName: string;
}

interface Task {
  id: string;
  completed: boolean;
  createdAt: any;
  completedAt?: any;
}

interface Note {
  id: string;
  content: string;
  createdAt: any;
}

interface ActivityData {
  date: string;
  total: number;
  details: string;
}

interface AnalyticsData {
  workloadData: { name: string; pending: number }[];
  totalPending: number;
  avgResponseTime: number;
  allNotesString: string;
  activityData: ActivityData[];
}

const AnalyticsSkeleton = () => (
    <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            <Skeleton className="h-40 rounded-[2rem]"/>
            <Skeleton className="h-40 rounded-[2rem]"/>
            <Skeleton className="h-40 rounded-[2rem]"/>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
             <Skeleton className="h-[400px] rounded-[2rem] lg:col-span-3"/>
             <Skeleton className="h-[400px] rounded-[2rem] lg:col-span-2"/>
             <Skeleton className="h-[400px] rounded-[2rem] lg:col-span-1"/>
             <Skeleton className="h-[200px] rounded-[2rem] lg:col-span-3"/>
             <Skeleton className="h-[400px] rounded-[2rem] lg:col-span-3"/>
        </div>
    </>
);


export default function AnalyticsPage() {
    const firestore = useFirestore();
    const [loading, setLoading] = useState(true);
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!firestore) return;

        const fetchAnalytics = async () => {
            setLoading(true);
            setError(null);
            try {
                // 1. Get all clients
                const clientsQuery = query(collection(firestore, 'clients'));
                const clientSnapshot = await getDocs(clientsQuery);
                const clients: Client[] = clientSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));

                // 2. Fetch all tasks for all clients
                const tasksPromises = clients.map(client => getDocs(collection(firestore, `clients/${client.id}/tasks`)));
                // 3. Fetch last 10 notes for all clients
                const notesPromises = clients.map(client => getDocs(query(collection(firestore, `clients/${client.id}/notes`), orderBy('createdAt', 'desc'), limit(10))));

                const [tasksByClientSnapshots, notesByClientSnapshots] = await Promise.all([Promise.all(tasksPromises), Promise.all(notesPromises)]);

                const tasksByClient = tasksByClientSnapshots.map((snap, index) => ({
                    clientId: clients[index].id,
                    clientName: clients[index].companyName,
                    tasks: snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task))
                }));
                
                const notesByClient = notesByClientSnapshots.map((snap, index) => ({
                    clientName: clients[index].companyName,
                    notes: snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Note))
                }));

                // 4. Process data
                let totalPending = 0;
                const workloadData: { name: string; pending: number }[] = [];
                const responseTimes: number[] = [];
                let allNotesString = '';
                const activityDataObj: { [date: string]: { tasks: number; notes: number; total: number } } = {};

                tasksByClient.forEach(client => {
                    const pendingTasks = client.tasks.filter(t => !t.completed).length;
                    totalPending += pendingTasks;
                    workloadData.push({ name: client.clientName, pending: pendingTasks });
                    
                    client.tasks.forEach(task => {
                        if (task.completed && task.createdAt?.toDate && task.completedAt?.toDate) {
                            const created = task.createdAt.toDate();
                            const completed = task.completedAt.toDate();
                            const diff = differenceInDays(completed, created);
                            responseTimes.push(diff);

                            const dateStr = format(completed, 'yyyy-MM-dd');
                            if (!activityDataObj[dateStr]) {
                                activityDataObj[dateStr] = { tasks: 0, notes: 0, total: 0 };
                            }
                            activityDataObj[dateStr].tasks++;
                            activityDataObj[dateStr].total++;
                        }
                    });
                });
                
                notesByClient.forEach(clientNotes => {
                    if(clientNotes.notes.length > 0) {
                         allNotesString += `**Cliente: ${clientNotes.clientName}**\n`;
                         clientNotes.notes.forEach(note => {
                             const date = note.createdAt?.toDate() ? formatDistanceToNow(note.createdAt.toDate(), { addSuffix: true, locale: es }) : 'fecha desconocida';
                             allNotesString += `- (${date}) ${note.content}\n`;

                             if (note.createdAt?.toDate) {
                                const dateStr = format(note.createdAt.toDate(), 'yyyy-MM-dd');
                                if (!activityDataObj[dateStr]) {
                                    activityDataObj[dateStr] = { tasks: 0, notes: 0, total: 0 };
                                }
                                activityDataObj[dateStr].notes++;
                                activityDataObj[dateStr].total++;
                             }
                         });
                         allNotesString += '\n';
                    }
                });

                const avgResponseTime = responseTimes.length > 0
                    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
                    : 0;

                const activityData = Object.entries(activityDataObj).map(([date, values]) => ({
                    date,
                    total: values.total,
                    details: `${values.tasks} tareas, ${values.notes} notas`
                }));

                setAnalytics({
                    workloadData,
                    totalPending,
                    avgResponseTime,
                    allNotesString,
                    activityData
                });

            } catch (err) {
                console.error("Error fetching analytics data:", err);
                setError("No se pudieron cargar los datos de análisis.");
            } finally {
                setLoading(false);
            }
        };

        fetchAnalytics();
    }, [firestore]);
    
    if (loading) {
        return (
             <motion.div
                initial="hidden"
                animate="visible"
                variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
                >
                <h1 className="text-5xl font-medium tracking-tight mb-8">Analytics</h1>
                <AnalyticsSkeleton />
            </motion.div>
        );
    }

    if (error || !analytics) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-zinc-500 text-center">
                <AlertTriangle className="h-10 w-10 mb-4 text-red-400"/>
                <h2 className="text-xl font-bold text-white">Error de Carga</h2>
                <p>{error || "No se pudieron obtener las métricas."}</p>
            </div>
        );
    }
    
    return (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
          className="space-y-6"
        >
          <h1 className="text-5xl font-medium tracking-tight">Analytics</h1>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnalyticsCard
              title="Carga de Trabajo Total"
              value={analytics.totalPending.toString()}
              icon={<ListTodo className="text-cyan-400" />}
              change="Tareas pendientes en todos los proyectos"
              index={0}
            />
            <AnalyticsCard
              title="Tiempo de Respuesta"
              value={`${analytics.avgResponseTime.toFixed(1)} días`}
              icon={<Clock className="text-lime-400" />}
              change="Promedio para completar una tarea"
              index={1}
            />
            <div className="hidden lg:block"></div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-3">
                <WorkloadChart data={analytics.workloadData} />
            </div>

            <div className="lg:col-span-2">
                <PipelineRevenueChart />
            </div>

            <div className="lg:col-span-1">
                <TicketStatusChart />
            </div>

            <div className="lg:col-span-3">
                <ActivityHeatmap data={analytics.activityData} />
            </div>
            
            <div className="lg:col-span-3">
              <AIPredictions allNotes={analytics.allNotesString} />
            </div>
          </div>
        </motion.div>
    );
}
