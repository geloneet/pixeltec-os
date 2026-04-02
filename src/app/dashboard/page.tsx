'use client';

import { useState, useEffect, useMemo } from 'react';
import { useFirestore } from '@/firebase';
import {
  collection, onSnapshot, query, orderBy,
  where, limit, Timestamp,
} from 'firebase/firestore';
import { motion } from 'framer-motion';
import {
  Plus, Users, ListTodo, LifeBuoy, AlertCircle,
  TrendingUp, TrendingDown, CalendarX2,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { format, isPast, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';
import { usePresentationMode } from '@/context/PresentationModeContext';
import StatsOverview from '@/components/dashboard/StatsOverview';
import RecentActivityFeed from '@/components/dashboard/RecentActivityFeed';
import { cn, formatCurrency } from '@/lib/utils';
import { staggerContainer, cardVariants } from '@/lib/animations';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Client {
  id: string;
  companyName: string;
  status: 'Lead' | 'Activo' | 'Inactivo';
  clientValue?: number;
}

interface Task {
  id: string;
  title: string;
  completed: boolean;
  status: 'Pendiente' | 'En proceso' | 'Completada';
  dueDate: Timestamp | null;
  responsible: string;
}

interface FinanceTransaction {
  id: string;
  amount: number;
  type: 'ingreso' | 'egreso' | 'Mensual' | 'Único';
  status: 'Pagado' | 'Pendiente';
  date: Timestamp;
  clientName?: string;
}

interface MonthlyRevenue {
  month: string;
  ingreso: number;
  egreso: number;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const SkeletonBlock = ({ className }: { className?: string }) => (
  <div className={cn('animate-pulse bg-zinc-800/80 rounded-[2rem]', className)} />
);

const DashboardSkeleton = () => (
  <div className="space-y-6">
    <div className="h-12 w-48 bg-zinc-800/80 rounded-xl animate-pulse" />
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <SkeletonBlock key={i} className="h-[152px]" />
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <SkeletonBlock className="lg:col-span-2 h-[320px]" />
      <SkeletonBlock className="h-[320px]" />
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <SkeletonBlock className="h-[260px]" />
      <SkeletonBlock className="lg:col-span-2 h-[260px]" />
    </div>
  </div>
);

// ─── Quick Actions ─────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { label: 'Nuevo Cliente',  href: '/dashboard/clients',  icon: Users,    color: 'text-lime-400'   },
  { label: 'Nueva Tarea',    href: '/dashboard/tasks',    icon: ListTodo, color: 'text-cyan-400'   },
  { label: 'Nuevo Ticket',   href: '/dashboard/support',  icon: LifeBuoy, color: 'text-yellow-400' },
  { label: 'Nuevo Lead',     href: '/dashboard/pipeline', icon: Plus,     color: 'text-purple-400' },
];

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const firestore = useFirestore();
  const { isPresentationMode } = usePresentationMode();

  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<Task[]>([]);
  const [recentFinances, setRecentFinances] = useState<FinanceTransaction[]>([]);

  // ── Real-time subscriptions ──────────────────────────────────────────────────
  useEffect(() => {
    if (!firestore) return;

    let loaded = { clients: false, tasks: false, finances: false };
    const checkAllLoaded = () => {
      if (Object.values(loaded).every(Boolean)) setLoading(false);
    };

    const unsubClients = onSnapshot(
      query(collection(firestore, 'clients'), orderBy('companyName', 'asc')),
      (snap) => {
        setClients(snap.docs.map(d => ({ id: d.id, ...d.data() } as Client)));
        loaded.clients = true;
        checkAllLoaded();
      },
      () => { loaded.clients = true; checkAllLoaded(); }
    );

    // Overdue tasks: status !== Completada, dueDate < now
    const unsubTasks = onSnapshot(
      query(
        collection(firestore, 'tasks'),
        where('status', '!=', 'Completada'),
        orderBy('status'),
        orderBy('dueDate', 'asc'),
        limit(10)
      ),
      (snap) => {
        const now = new Date();
        const overdue = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as Task))
          .filter(t => t.dueDate && isPast(t.dueDate.toDate()));
        setOverdueTasks(overdue);
        loaded.tasks = true;
        checkAllLoaded();
      },
      () => { loaded.tasks = true; checkAllLoaded(); }
    );

    const unsubFinances = onSnapshot(
      query(collection(firestore, 'finances'), orderBy('date', 'desc'), limit(200)),
      (snap) => {
        setRecentFinances(snap.docs.map(d => ({ id: d.id, ...d.data() } as FinanceTransaction)));
        loaded.finances = true;
        checkAllLoaded();
      },
      () => { loaded.finances = true; checkAllLoaded(); }
    );

    return () => { unsubClients(); unsubTasks(); unsubFinances(); };
  }, [firestore]);

  // ── Derived data ─────────────────────────────────────────────────────────────

  const clientStatusData = useMemo(() => {
    const counts = clients.reduce((acc, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return [
      { name: 'Activo', value: counts['Activo'] || 0 },
      { name: 'Lead',   value: counts['Lead']   || 0 },
      { name: 'Inactivo', value: counts['Inactivo'] || 0 },
    ].filter(d => d.value > 0);
  }, [clients]);

  // Revenue trend: last 6 months
  const revenueTrendData = useMemo((): MonthlyRevenue[] => {
    const months: MonthlyRevenue[] = Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(new Date(), 5 - i);
      return { month: format(d, 'MMM', { locale: es }), ingreso: 0, egreso: 0 };
    });

    recentFinances.forEach(t => {
      if (t.status !== 'Pagado' || !t.date?.toDate) return;
      const txDate = t.date.toDate();
      const monthLabel = format(txDate, 'MMM', { locale: es });
      const entry = months.find(m => m.month === monthLabel);
      if (!entry) return;
      // Classify: "Mensual" and "Único" payment types are income, explicit "egreso" is expense
      if (t.type === 'egreso') {
        entry.egreso += t.amount;
      } else {
        entry.ingreso += t.amount;
      }
    });

    return months;
  }, [recentFinances]);

  // Top 3 clients by clientValue
  const topClients = useMemo(() =>
    [...clients]
      .filter(c => c.status === 'Activo' && c.clientValue)
      .sort((a, b) => (b.clientValue ?? 0) - (a.clientValue ?? 0))
      .slice(0, 4),
    [clients]
  );

  const totalRevenue6m = useMemo(
    () => revenueTrendData.reduce((s, m) => s + m.ingreso, 0),
    [revenueTrendData]
  );
  const prevMonthRevenue = revenueTrendData[revenueTrendData.length - 2]?.ingreso ?? 0;
  const currMonthRevenue = revenueTrendData[revenueTrendData.length - 1]?.ingreso ?? 0;
  const revenueGrowth = prevMonthRevenue > 0
    ? ((currMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100
    : 0;

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) return <DashboardSkeleton />;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className="space-y-6"
    >
      <h1 className="text-5xl font-medium tracking-tight">Overview</h1>

      {/* ── Row 1: KPI Cards ── */}
      <StatsOverview />

      {!isPresentationMode && (
        <>
          {/* ── Row 2: Revenue Trend + Client Distribution ── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

            {/* Revenue Trend — 6 months */}
            <motion.div
              variants={cardVariants} custom={0}
              className="lg:col-span-3 bg-black rounded-[2rem] border border-white/5 p-6 shadow-2xl"
            >
              <div className="flex items-start justify-between mb-1">
                <div>
                  <h2 className="text-base font-medium text-zinc-400">Ingresos vs Egresos</h2>
                  <p className="text-2xl font-semibold text-white mt-1">
                    {formatCurrency(totalRevenue6m)}
                    <span className="text-xs text-zinc-500 font-normal ml-2">últimos 6 meses</span>
                  </p>
                </div>
                <div className={cn(
                  'flex items-center gap-1 text-sm font-semibold px-3 py-1 rounded-full border',
                  revenueGrowth >= 0
                    ? 'bg-lime-400/10 text-lime-400 border-lime-400/20'
                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                )}>
                  {revenueGrowth >= 0
                    ? <TrendingUp className="w-3.5 h-3.5" />
                    : <TrendingDown className="w-3.5 h-3.5" />}
                  {Math.abs(revenueGrowth).toFixed(1)}% vs mes anterior
                </div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={revenueTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradIngreso" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#a3e635" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#a3e635" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradEgreso" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#f87171" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="month" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#71717a" fontSize={11} tickLine={false} axisLine={false}
                    tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Area type="monotone" dataKey="ingreso" stroke="#a3e635" strokeWidth={2} fill="url(#gradIngreso)" name="Ingresos" />
                  <Area type="monotone" dataKey="egreso"  stroke="#f87171" strokeWidth={2} fill="url(#gradEgreso)"  name="Egresos" />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Client Distribution */}
            <motion.div
              variants={cardVariants} custom={1}
              className="lg:col-span-2 bg-black rounded-[2rem] border border-white/5 p-6 shadow-2xl"
            >
              <h2 className="text-base font-medium text-zinc-400 mb-1">Clientes</h2>
              <p className="text-2xl font-semibold text-white mb-4">{clients.length} total</p>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={clientStatusData} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" outerRadius={70} innerRadius={40} paddingAngle={3}>
                    <Cell fill="#a3e635" />
                    <Cell fill="#22d3ee" />
                    <Cell fill="#3f3f46" />
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex gap-4 justify-center mt-2">
                {clientStatusData.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: ['#a3e635', '#22d3ee', '#3f3f46'][i] }} />
                    <span className="text-xs text-zinc-400">{item.name} <strong className="text-white">{item.value}</strong></span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* ── Row 3: Overdue Tasks + Quick Actions + Top Clients ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Overdue Tasks Widget */}
            <motion.div
              variants={cardVariants} custom={2}
              className="bg-black rounded-[2rem] border border-white/5 p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-medium text-zinc-400 flex items-center gap-2">
                  <CalendarX2 className="w-4 h-4 text-red-400" />
                  Tareas Vencidas
                </h2>
                {overdueTasks.length > 0 && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                    {overdueTasks.length}
                  </span>
                )}
              </div>

              {overdueTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-zinc-600 text-sm">
                  <CalendarX2 className="w-8 h-8 mb-2 opacity-40" />
                  Sin tareas vencidas
                </div>
              ) : (
                <ul className="space-y-2">
                  {overdueTasks.slice(0, 5).map(task => (
                    <li key={task.id}
                      className="flex items-start gap-3 p-2.5 rounded-xl bg-red-500/5 border border-red-500/10">
                      <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm text-zinc-200 truncate">{task.title}</p>
                        <p className="text-xs text-red-400 mt-0.5">
                          Venció: {task.dueDate
                            ? format(task.dueDate.toDate(), "dd MMM", { locale: es })
                            : '—'}
                          {task.responsible && ` · ${task.responsible}`}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/dashboard/tasks"
                className="block text-center text-xs text-cyan-400 hover:text-cyan-300 mt-4 transition-colors">
                Ver todas las tareas →
              </Link>
            </motion.div>

            {/* Quick Actions */}
            <motion.div
              variants={cardVariants} custom={3}
              className="bg-black rounded-[2rem] border border-white/5 p-6 shadow-2xl"
            >
              <h2 className="text-base font-medium text-zinc-400 mb-4">Acciones Rápidas</h2>
              <div className="grid grid-cols-2 gap-3">
                {QUICK_ACTIONS.map(({ label, href, icon: Icon, color }) => (
                  <Link key={href} href={href}
                    className="flex flex-col items-center justify-center gap-2 p-4 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-2xl transition-all group">
                    <Icon className={cn('w-6 h-6 transition-transform group-hover:scale-110', color)} />
                    <span className="text-xs text-zinc-300 font-medium text-center leading-tight">{label}</span>
                  </Link>
                ))}
              </div>
            </motion.div>

            {/* Top Clients by Value */}
            <motion.div
              variants={cardVariants} custom={4}
              className="bg-black rounded-[2rem] border border-white/5 p-6 shadow-2xl"
            >
              <h2 className="text-base font-medium text-zinc-400 mb-4">Top Clientes</h2>
              {topClients.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-zinc-600 text-sm">
                  <Users className="w-8 h-8 mb-2 opacity-40" />
                  Sin datos de valor de cliente
                </div>
              ) : (
                <ul className="space-y-3">
                  {topClients.map((client, i) => (
                    <li key={client.id}>
                      <Link href={`/dashboard/clients/${client.id}`}
                        className="flex items-center gap-3 group">
                        <span className="text-xs font-mono text-zinc-600 w-4 flex-shrink-0">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-200 truncate group-hover:text-cyan-400 transition-colors">
                            {client.companyName}
                          </p>
                          <div className="mt-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-cyan-500 to-lime-400 rounded-full"
                              style={{
                                width: `${Math.min(100,
                                  ((client.clientValue ?? 0) / (topClients[0]?.clientValue ?? 1)) * 100
                                )}%`
                              }}
                            />
                          </div>
                        </div>
                        <span className="text-xs font-mono text-lime-400 flex-shrink-0">
                          {formatCurrency(client.clientValue ?? 0)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/dashboard/clients"
                className="block text-center text-xs text-cyan-400 hover:text-cyan-300 mt-4 transition-colors">
                Ver directorio completo →
              </Link>
            </motion.div>
          </div>

          {/* ── Row 4: Activity Feed ── */}
          <motion.div variants={cardVariants} custom={5}>
            <RecentActivityFeed />
          </motion.div>
        </>
      )}
    </motion.div>
  );
}
