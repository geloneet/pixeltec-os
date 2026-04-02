'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2, LogOut, RefreshCw, CheckCircle2, Clock, FolderKanban,
  MessageSquare, ImageIcon, CalendarDays, ChevronRight, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { loadPortalSession, clearPortalSession, type PortalSession } from '@/lib/portal';
import { getPortalDashboardAction } from '@/app/actions';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Update {
  id: string;
  text: string;
  imageUrl?: string;
  createdAt: string;
  createdBy: string;
}

interface Project {
  id: string;
  name: string;
  status: string;
}

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  'Activo':        { bg: 'bg-lime-500/15', text: 'text-lime-400', dot: 'bg-lime-400' },
  'En desarrollo': { bg: 'bg-blue-500/15', text: 'text-blue-400', dot: 'bg-blue-400' },
  'Planeación':    { bg: 'bg-zinc-500/15', text: 'text-zinc-400', dot: 'bg-zinc-400' },
  'En revisión':   { bg: 'bg-yellow-500/15', text: 'text-yellow-400', dot: 'bg-yellow-400' },
  'Entregado':     { bg: 'bg-green-500/15', text: 'text-green-400', dot: 'bg-green-400' },
  'Cancelado':     { bg: 'bg-red-500/15', text: 'text-red-400', dot: 'bg-red-400' },
  'Lead':          { bg: 'bg-cyan-500/15', text: 'text-cyan-400', dot: 'bg-cyan-400' },
  'Inactivo':      { bg: 'bg-zinc-500/15', text: 'text-zinc-400', dot: 'bg-zinc-500' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES['Activo'];
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold', s.bg, s.text)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
      {status}
    </span>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-white/5', className)} />;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-28 w-full rounded-2xl" />
      <Skeleton className="h-24 w-full rounded-2xl" />
      <div className="space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PortalDashboard() {
  const params = useParams();
  const router = useRouter();
  const slug   = (params.slug as string) ?? '';

  const [session, setSession] = useState<PortalSession | null>(null);
  const [loading, setLoading]  = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [updates, setUpdates]   = useState<Update[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [taskProgress, setTaskProgress] = useState({ total: 0, completed: 0, percentage: 0 });
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  // ── Session check ──────────────────────────────────────────────────────────
  useEffect(() => {
    const s = loadPortalSession(slug);
    if (!s) {
      router.replace(`/${slug}`);
      return;
    }
    setSession(s);
  }, [slug, router]);

  // ── Fetch data ─────────────────────────────────────────────────────────────
  const fetchData = useCallback(async (isRefresh = false) => {
    if (!session) return;
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError('');

    const res = await getPortalDashboardAction(session.clientId);
    if (res.success && res.data) {
      setUpdates(res.data.updates);
      setProjects(res.data.projects);
      setTaskProgress(res.data.taskProgress);
      setLastFetched(new Date());
    } else {
      setError(res.error ?? 'Error al cargar el portal.');
    }
    isRefresh ? setRefreshing(false) : setLoading(false);
  }, [session]);

  useEffect(() => {
    if (session) fetchData();
  }, [session, fetchData]);

  // ── Sign out ───────────────────────────────────────────────────────────────
  const handleSignOut = () => {
    clearPortalSession();
    router.push(`/${slug}`);
  };

  // ── Guards ─────────────────────────────────────────────────────────────────
  if (!session && typeof window !== 'undefined') {
    return null; // redirect happening
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#050505]">

      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-0 left-[50%] -translate-x-1/2 w-[700px] h-[300px] bg-cyan-500/4 rounded-full blur-[100px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#050505]/80 backdrop-blur-xl">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <p className="font-bold text-white text-sm">
            Pixel<span className="text-cyan-400">TEC</span>
            <span className="ml-2 text-zinc-600 font-normal text-xs">Portal</span>
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm" variant="ghost"
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="text-zinc-500 hover:text-white h-8 w-8 p-0"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            </Button>
            <Button
              size="sm" variant="ghost"
              onClick={handleSignOut}
              className="text-zinc-500 hover:text-white text-xs h-8 gap-1"
            >
              <LogOut className="h-3.5 w-3.5" />
              Salir
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6 relative z-10">

        {loading ? <DashboardSkeleton /> : error ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <AlertCircle className="h-10 w-10 text-red-400" />
            <p className="text-red-400 font-medium">{error}</p>
            <Button onClick={() => fetchData()} variant="outline" size="sm" className="border-white/20 mt-2">
              Reintentar
            </Button>
          </div>
        ) : (
          <AnimatePresence>

            {/* ── Company header card ── */}
            <motion.div
              key="header-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-white/8 bg-[#111111] overflow-hidden"
            >
              <div className="h-[2px] bg-gradient-to-r from-cyan-500 to-lime-400" />
              <div className="p-6 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-1">Tu empresa</p>
                  <h1 className="text-2xl font-bold text-white leading-tight">
                    {session?.companyName}
                  </h1>
                  <div className="mt-2">
                    <StatusBadge status={session?.status ?? 'Activo'} />
                  </div>
                </div>
              </div>
            </motion.div>

            {/* ── Task progress ── */}
            {taskProgress.total > 0 && (
              <motion.div
                key="progress"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="rounded-2xl border border-white/8 bg-[#111111] p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-cyan-400" />
                    <span className="font-semibold text-white">Progreso del Proyecto</span>
                  </div>
                  <span className="text-2xl font-bold text-cyan-400 tabular-nums">
                    {taskProgress.percentage}%
                  </span>
                </div>
                <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${taskProgress.percentage}%` }}
                    transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
                    className="h-full bg-gradient-to-r from-cyan-500 to-lime-400 rounded-full"
                  />
                </div>
                <p className="text-xs text-zinc-500 mt-2">
                  {taskProgress.completed} de {taskProgress.total} tareas completadas
                </p>
              </motion.div>
            )}

            {/* ── Projects ── */}
            {projects.length > 0 && (
              <motion.div
                key="projects"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="rounded-2xl border border-white/8 bg-[#111111] p-6"
              >
                <div className="flex items-center gap-2 mb-4">
                  <FolderKanban className="h-5 w-5 text-violet-400" />
                  <span className="font-semibold text-white">Proyectos</span>
                </div>
                <div className="space-y-2">
                  {projects.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                      <span className="text-sm text-zinc-200 font-medium">{p.name}</span>
                      <StatusBadge status={p.status} />
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── Updates timeline ── */}
            <motion.div
              key="updates"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="rounded-2xl border border-white/8 bg-[#111111] p-6"
            >
              <div className="flex items-center gap-2 mb-6">
                <MessageSquare className="h-5 w-5 text-lime-400" />
                <span className="font-semibold text-white">Actualizaciones</span>
                {lastFetched && (
                  <span className="ml-auto text-xs text-zinc-600">
                    <Clock className="h-3 w-3 inline mr-1" />
                    {format(lastFetched, 'HH:mm', { locale: es })}
                  </span>
                )}
              </div>

              {updates.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <MessageSquare className="h-8 w-8 text-zinc-700 mx-auto" />
                  <p className="text-zinc-600 text-sm">Aún no hay actualizaciones.</p>
                  <p className="text-zinc-700 text-xs">Tu equipo publicará el progreso aquí.</p>
                </div>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-4 top-2 bottom-2 w-px bg-white/5" />

                  <div className="space-y-6 pl-10">
                    {updates.map((update, i) => (
                      <motion.div
                        key={update.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.06 }}
                        className="relative"
                      >
                        {/* Timeline dot */}
                        <div className="absolute -left-[30px] top-1 h-4 w-4 rounded-full border-2 border-cyan-500 bg-[#111111]" />

                        <div className="bg-white/5 rounded-xl overflow-hidden border border-white/5">
                          {update.imageUrl && (
                            <div className="relative">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={update.imageUrl}
                                alt="Actualización"
                                className="w-full max-h-56 object-cover"
                                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                              />
                              <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/60 rounded-lg px-2 py-1 text-xs text-zinc-400">
                                <ImageIcon className="h-3 w-3" />
                                imagen
                              </div>
                            </div>
                          )}
                          <div className="p-4">
                            <p className="text-zinc-200 text-sm leading-relaxed whitespace-pre-wrap">
                              {update.text}
                            </p>
                            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
                              <div className="h-5 w-5 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 text-[10px] font-bold">
                                {update.createdBy.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-xs text-zinc-500">{update.createdBy}</span>
                              <span className="ml-auto text-xs text-zinc-600 flex items-center gap-1">
                                <CalendarDays className="h-3 w-3" />
                                {format(parseISO(update.createdAt), "d 'de' MMM, yyyy", { locale: es })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>

          </AnimatePresence>
        )}

      </main>
    </div>
  );
}
