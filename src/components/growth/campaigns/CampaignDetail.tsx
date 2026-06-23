'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Sparkles, Loader2, CheckCircle2, Clock, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CREDIT_COSTS } from '@/lib/growth/credits/costs';
import type { CampaignClient } from '@/lib/growth/actions/campaigns';

const PURPOSE_LABELS: Record<string, string> = {
  awareness: 'Awareness',
  consideration: 'Consideración',
  conversion: 'Conversión',
  social_proof: 'Prueba social',
  retention: 'Retención',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-zinc-600',
  generating: 'text-amber-400',
  done: 'text-emerald-400',
  failed: 'text-red-400',
};

interface Props {
  campaign: CampaignClient;
}

export function CampaignDetail({ campaign }: Props) {
  const router = useRouter();
  const [generatingStrategy, setGeneratingStrategy] = useState(false);

  async function handleGenerateStrategy() {
    setGeneratingStrategy(true);
    try {
      const res = await fetch(`/api/growth/campaigns/${campaign.id}/strategy`, { method: 'POST' });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Error al generar estrategia');
      toast.success('Estrategia generada');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setGeneratingStrategy(false);
    }
  }

  const strategy = campaign.strategy;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-poppins text-3xl font-bold text-zinc-50">{campaign.name}</h1>
          <p className="mt-1 font-roboto text-sm text-zinc-500">{campaign.objective}</p>
        </div>
        {!strategy && (
          <Button onClick={handleGenerateStrategy} disabled={generatingStrategy} className="gap-2">
            {generatingStrategy
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Generando...</>
              : <><Sparkles className="h-4 w-4" /> Generar estrategia ({CREDIT_COSTS.campaign_strategy} créditos)</>
            }
          </Button>
        )}
      </div>

      {!strategy && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 py-16 text-center">
          <Sparkles className="mb-4 h-10 w-10 text-zinc-700" />
          <h3 className="font-poppins font-bold text-zinc-300">Sin estrategia aún</h3>
          <p className="mt-2 font-roboto text-sm text-zinc-600">
            La IA creará un plan de posts coordinado basado en tu objetivo.
          </p>
        </div>
      )}

      {strategy && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-800/50 bg-zinc-900/40 p-5">
            <h2 className="mb-3 font-poppins text-lg font-bold text-zinc-100">{strategy.campaignName}</h2>
            <div className="grid gap-3 sm:grid-cols-3 text-sm">
              <div>
                <p className="font-roboto text-xs text-zinc-600">Ángulo</p>
                <p className="mt-1 font-roboto text-zinc-300">{strategy.angle}</p>
              </div>
              <div>
                <p className="font-roboto text-xs text-zinc-600">Dolor atacado</p>
                <p className="mt-1 font-roboto text-zinc-300">{strategy.targetedPain}</p>
              </div>
              <div>
                <p className="font-roboto text-xs text-zinc-600">Mensaje clave</p>
                <p className="mt-1 font-roboto text-zinc-300">{strategy.keyMessage}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 border-t border-zinc-800/60 pt-4">
              <Zap className="h-4 w-4 text-amber-400" />
              <p className="font-roboto text-xs text-zinc-500">
                Costo estimado: <span className="text-zinc-300">{strategy.estimatedCredits} créditos</span>
                {' '}({strategy.postPlans.length} posts × {CREDIT_COSTS.campaign_post} créditos)
              </p>
            </div>
          </div>

          <div>
            <h3 className="mb-3 font-poppins text-sm font-semibold text-zinc-400">Plan de posts</h3>
            <div className="space-y-2">
              {strategy.postPlans.map((plan, i) => (
                <div key={plan.planId} className="flex items-center gap-4 rounded-xl border border-zinc-800/50 bg-zinc-900/40 p-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-800 font-poppins text-sm font-bold text-zinc-400">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded-lg bg-zinc-800 px-2 py-0.5 font-roboto text-xs text-zinc-400">
                        {PURPOSE_LABELS[plan.purpose] ?? plan.purpose}
                      </span>
                      <span className="font-roboto text-xs text-zinc-600">{plan.format}</span>
                    </div>
                    <p className="mt-1 font-roboto text-sm text-zinc-300 line-clamp-1">{plan.keyMessage}</p>
                  </div>
                  <div className={`shrink-0 font-roboto text-xs ${STATUS_COLORS[plan.status] ?? ''}`}>
                    {plan.status === 'done' && <CheckCircle2 className="h-4 w-4" />}
                    {plan.status === 'pending' && <Clock className="h-4 w-4" />}
                    {plan.status === 'generating' && <Loader2 className="h-4 w-4 animate-spin" />}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {campaign.status === 'strategy_ready' && (
            <Button
              className="w-full gap-2"
              onClick={() => toast.info('Generación masiva de posts disponible en Sprint 4')}
            >
              <Zap className="h-4 w-4" />
              Generar todos los posts ({strategy.estimatedCredits} créditos)
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
