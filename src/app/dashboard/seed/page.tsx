'use client';

import { useState } from 'react';
import {
  Database,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Users,
  ListTodo,
  TrendingUp,
  DollarSign,
  LifeBuoy,
  Activity,
  Sprout,
  Trash2,
} from 'lucide-react';
import { useFirestore } from '@/firebase';
import { useUserProfile } from '@/firebase/auth/use-user-profile';
import { seedDemoData, SEED_SUMMARY, type SeedProgress } from '@/lib/seed/demo-data';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// ─── Seed inventory ────────────────────────────────────────────────────────────

const SEED_INVENTORY = [
  {
    icon: Users,
    label: 'Clientes',
    count: SEED_SUMMARY.clients,
    detail: `${SEED_SUMMARY.clientTasks} tareas + ${SEED_SUMMARY.clientNotes} notas en subcolecciones`,
    color: 'text-cyan-400',
  },
  {
    icon: ListTodo,
    label: 'Tareas globales',
    count: SEED_SUMMARY.globalTasks,
    detail: 'Con estados: Pendiente, En Progreso, Completada',
    color: 'text-lime-400',
  },
  {
    icon: TrendingUp,
    label: 'Leads (Pipeline)',
    count: SEED_SUMMARY.leads,
    detail: 'Distribuidos en todas las etapas del funnel',
    color: 'text-violet-400',
  },
  {
    icon: DollarSign,
    label: 'Transacciones',
    count: SEED_SUMMARY.finances,
    detail: 'Ingresos y egresos de los últimos 6 meses',
    color: 'text-yellow-400',
  },
  {
    icon: LifeBuoy,
    label: 'Tickets de soporte',
    count: SEED_SUMMARY.tickets,
    detail: 'Con prioridades Alta, Media, Baja y estados varios',
    color: 'text-orange-400',
  },
  {
    icon: Activity,
    label: 'Actividad reciente',
    count: SEED_SUMMARY.activity,
    detail: 'Entradas del feed de actividad del sistema',
    color: 'text-pink-400',
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

type Phase = 'idle' | 'confirming' | 'seeding' | 'done' | 'error';

export default function SeedPage() {
  const firestore = useFirestore();
  const { userProfile, loading: profileLoading } = useUserProfile();
  const { toast } = useToast();

  const [phase, setPhase] = useState<Phase>('idle');
  const [force, setForce] = useState(false);
  const [progress, setProgress] = useState<SeedProgress | null>(null);
  const [result, setResult] = useState<{ message: string; counts: Record<string, number> } | null>(null);

  const progressPct = progress
    ? progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0
    : 0;

  const isAdmin = userProfile?.role === 'admin';

  // ── Seed execution ─────────────────────────────────────────────────────────

  const handleSeed = async () => {
    if (!firestore) {
      toast({ variant: 'destructive', title: 'Sin conexión', description: 'Firestore no está disponible.' });
      return;
    }

    setPhase('seeding');
    setProgress(null);

    const res = await seedDemoData(firestore, (p) => setProgress(p), { force });

    setResult({ message: res.message, counts: res.counts });
    setPhase(res.success ? 'done' : 'error');

    if (res.success) {
      toast({ title: '✅ Demo data insertada', description: res.message });
    } else {
      toast({ variant: 'destructive', title: 'Error en seeding', description: res.message });
    }
  };

  // ── Access guard ───────────────────────────────────────────────────────────

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center px-4">
        <AlertTriangle className="h-12 w-12 text-yellow-400" />
        <h1 className="text-2xl font-bold text-white">Acceso Restringido</h1>
        <p className="text-zinc-400 max-w-sm">
          Esta sección solo está disponible para administradores.
        </p>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-cyan-500/10 rounded-xl border border-cyan-500/20">
          <Sprout className="h-6 w-6 text-cyan-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Demo Data Seeder</h1>
          <p className="text-zinc-400 text-sm">Inserta datos de demostración realistas en Firestore</p>
        </div>
      </div>

      {/* Warning banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-yellow-400/5 border border-yellow-400/20">
        <AlertTriangle className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold text-yellow-300">Solo para entornos de demostración</p>
          <p className="text-zinc-400 mt-1">
            Esta acción crea datos de prueba en tu base de datos de Firestore.
            Si la colección <code className="bg-white/10 px-1 rounded text-xs">clients</code> ya tiene registros,
            el proceso se cancelará automáticamente para evitar duplicados.
          </p>
        </div>
      </div>

      {/* Inventory */}
      <div className="bg-black rounded-[2rem] border border-white/5 p-6">
        <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-4">
          Qué se va a insertar
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SEED_INVENTORY.map((item) => (
            <div
              key={item.label}
              className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5"
            >
              <item.icon className={cn('h-5 w-5 flex-shrink-0 mt-0.5', item.color)} />
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-white text-sm">{item.label}</span>
                  <span className={cn('text-xs font-bold', item.color)}>{item.count}</span>
                </div>
                <p className="text-xs text-zinc-500 mt-0.5 leading-tight">{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Progress / Result */}
      {phase === 'seeding' && (
        <div className="bg-black rounded-[2rem] border border-white/5 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-cyan-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {progress?.step ?? 'Iniciando...'}
              </p>
              <p className="text-xs text-zinc-500">
                {progress ? `${progress.done} / ${progress.total}` : ''}
              </p>
            </div>
            <span className="text-sm font-bold text-cyan-400 tabular-nums">{progressPct}%</span>
          </div>
          <Progress value={progressPct} className="h-2 bg-white/5" />
        </div>
      )}

      {phase === 'done' && result && (
        <div className="bg-black rounded-[2rem] border border-lime-500/20 p-6">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle2 className="h-6 w-6 text-lime-400" />
            <p className="font-semibold text-lime-300">{result.message}</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(result.counts).map(([key, val]) => (
              <div key={key} className="p-3 rounded-xl bg-white/5 border border-white/5 text-center">
                <p className="text-2xl font-bold text-white">{val}</p>
                <p className="text-xs text-zinc-500 capitalize mt-1">{key}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {phase === 'error' && result && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/5 border border-red-500/20">
          <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">{result.message}</p>
        </div>
      )}

      {/* Actions */}
      {phase === 'idle' && (
        <div className="space-y-4">
          {/* Force toggle */}
          <label className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/10 cursor-pointer select-none hover:border-white/20 transition-colors">
            <input
              type="checkbox"
              checked={force}
              onChange={(e) => setForce(e.target.checked)}
              className="mt-0.5 accent-red-500 h-4 w-4 flex-shrink-0"
            />
            <div>
              <p className={cn('font-semibold text-sm', force ? 'text-red-300' : 'text-zinc-300')}>
                Sobreescribir datos existentes
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">
                Si está activo, se borrarán todos los registros actuales de{' '}
                <code className="bg-white/10 px-1 rounded">clients</code>,{' '}
                <code className="bg-white/10 px-1 rounded">tasks</code>,{' '}
                <code className="bg-white/10 px-1 rounded">leads</code>,{' '}
                <code className="bg-white/10 px-1 rounded">finances</code>,{' '}
                <code className="bg-white/10 px-1 rounded">tickets</code> y{' '}
                <code className="bg-white/10 px-1 rounded">activity</code> antes de insertar.
              </p>
            </div>
          </label>

          <Button
            onClick={() => setPhase('confirming')}
            className={cn(
              'font-bold',
              force
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : 'bg-cyan-500 hover:bg-cyan-400 text-black'
            )}
          >
            {force ? (
              <><Trash2 className="mr-2 h-4 w-4" />Limpiar e Insertar Demo Data</>
            ) : (
              <><Database className="mr-2 h-4 w-4" />Insertar Demo Data</>
            )}
          </Button>
        </div>
      )}

      {phase === 'confirming' && (
        <div className={cn(
          'bg-black rounded-[2rem] border p-6 space-y-4',
          force ? 'border-red-500/40' : 'border-white/10'
        )}>
          <div className="flex items-start gap-3">
            <AlertTriangle className={cn('h-5 w-5 flex-shrink-0 mt-0.5', force ? 'text-red-400' : 'text-yellow-400')} />
            <div>
              <p className="font-semibold text-white">
                {force ? '⚠️ Se borrarán todos los datos actuales' : '¿Confirmas la inserción?'}
              </p>
              <p className="text-sm text-zinc-400 mt-1">
                {force
                  ? 'Esta acción eliminará permanentemente todos los registros de las colecciones indicadas antes de insertar los datos de demostración. No se puede deshacer.'
                  : 'Se escribirán datos en Firestore. Si ya existen registros en clients, el proceso se cancelará automáticamente.'}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={handleSeed}
              className={force ? 'bg-red-600 hover:bg-red-500 text-white font-bold' : 'bg-cyan-500 hover:bg-cyan-400 text-black font-bold'}
            >
              {force ? 'Sí, borrar e insertar' : 'Sí, insertar datos'}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setPhase('idle')}
              className="text-zinc-400 hover:text-white"
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {(phase === 'done' || phase === 'error') && (
        <Button
          variant="outline"
          onClick={() => { setPhase('idle'); setProgress(null); setResult(null); }}
          className="border-white/20 hover:bg-white/10 text-zinc-300"
        >
          Reiniciar
        </Button>
      )}
    </div>
  );
}
