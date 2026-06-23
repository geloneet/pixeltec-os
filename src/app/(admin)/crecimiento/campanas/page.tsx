import Link from 'next/link';
import { Plus, Megaphone, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getCampaigns } from '@/lib/growth/actions/campaigns';

const STATUS_LABELS: Record<string, string> = {
  planning: 'Planeando',
  strategy_ready: 'Estrategia lista',
  generating: 'Generando',
  review: 'En revisión',
  active: 'Activa',
  completed: 'Completada',
  archived: 'Archivada',
};

const STATUS_COLORS: Record<string, string> = {
  planning: 'bg-zinc-800 text-zinc-400',
  strategy_ready: 'bg-cyan-500/20 text-cyan-300',
  generating: 'bg-amber-500/20 text-amber-300',
  review: 'bg-purple-500/20 text-purple-300',
  active: 'bg-emerald-500/20 text-emerald-300',
  completed: 'bg-zinc-700 text-zinc-400',
  archived: 'bg-zinc-800 text-zinc-600',
};

export default async function CampanasPage() {
  const campaigns = await getCampaigns();

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-8 lg:px-10">
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-poppins text-3xl font-bold tracking-tight text-zinc-50">Campañas</h1>
          <p className="mt-1 font-roboto text-sm text-zinc-500">
            Estrategias de contenido multi-post coordinadas.
          </p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/crecimiento/campanas/nueva">
            <Plus className="h-4 w-4" /> Nueva campaña
          </Link>
        </Button>
      </header>

      {campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 py-20 text-center">
          <Megaphone className="mb-4 h-12 w-12 text-zinc-700" />
          <h3 className="font-poppins text-lg font-bold text-zinc-300">Sin campañas aún</h3>
          <p className="mt-2 font-roboto text-sm text-zinc-600">
            Crea tu primera campaña para generar una serie coordinada de posts.
          </p>
          <Button asChild className="mt-6 gap-2">
            <Link href="/crecimiento/campanas/nueva">
              <Plus className="h-4 w-4" /> Crear campaña
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((c) => (
            <Link key={c.id} href={`/crecimiento/campanas/${c.id}`}>
              <div className="rounded-2xl border border-zinc-800/50 bg-zinc-900/40 p-5 transition-colors hover:border-zinc-700/60">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <span className={`rounded-lg px-2.5 py-0.5 font-roboto text-xs font-medium ${STATUS_COLORS[c.status] ?? STATUS_COLORS.planning}`}>
                    {STATUS_LABELS[c.status] ?? c.status}
                  </span>
                  {c.counters.totalPosts > 0 && (
                    <span className="flex items-center gap-1 font-roboto text-xs text-zinc-600">
                      <TrendingUp className="h-3.5 w-3.5" />
                      {c.counters.generatedPosts}/{c.counters.totalPosts} posts
                    </span>
                  )}
                </div>
                <h3 className="font-poppins font-semibold text-zinc-100">{c.name}</h3>
                <p className="mt-1 line-clamp-2 font-roboto text-xs text-zinc-500">{c.objective}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
