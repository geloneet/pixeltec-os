'use client';

import { useState } from 'react';
import { Zap, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBrands } from '@/hooks/growth/use-brands';
import { useCredits, canAfford } from '@/hooks/growth/use-credits';
import { CreditBalance } from '@/components/growth/shared/CreditBalance';
import { CREDIT_COSTS } from '@/lib/growth/credits/costs';
import type { PostGenerationRequest } from '@/lib/growth/ai/prompt-builder';
import type { ContentPost } from '@/types/growth/post';

const FORMAT_OPTIONS = [
  { value: 'instagram_post', label: 'Instagram Feed' },
  { value: 'instagram_story', label: 'Instagram Story' },
  { value: 'facebook_post', label: 'Facebook' },
  { value: 'linkedin_post', label: 'LinkedIn' },
  { value: 'twitter_post', label: 'Twitter/X' },
] as const;

const inputCls = 'w-full rounded-xl border border-zinc-700/60 bg-zinc-800/50 px-3.5 py-2.5 font-roboto text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-colors focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30';

interface Props {
  defaultBrandId?: string;
  onGenerated: (post: ContentPost) => void;
  onGenerating?: (isGenerating: boolean) => void;
}

export function PostGeneratorForm({ defaultBrandId, onGenerated, onGenerating }: Props) {
  const { data: brands } = useBrands();
  const { data: credits } = useCredits();

  const [brandId, setBrandId] = useState(defaultBrandId ?? '');
  const [format, setFormat] = useState<PostGenerationRequest['format']>('instagram_post');
  const [objective, setObjective] = useState('');
  const [topic, setTopic] = useState('');
  const [withImage, setWithImage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const creditOp = withImage ? 'post_complete' : 'post_text_only';
  const cost = CREDIT_COSTS[creditOp];
  const affordable = credits ? canAfford(credits.balance, cost) : false;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!brandId || !objective.trim()) return;
    setError(null);
    setLoading(true);
    onGenerating?.(true);

    try {
      const res = await fetch('/api/growth/generate-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId, request: { objective, format, topic, withImage } }),
      });

      const data = (await res.json()) as { post?: ContentPost; error?: string };
      if (!res.ok || !data.post) throw new Error(data.error ?? 'Error al generar');
      onGenerated(data.post);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
      onGenerating?.(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-poppins text-lg font-bold text-zinc-100">Nuevo contenido</h2>
        <CreditBalance />
      </div>

      <div>
        <label className="mb-1.5 block font-roboto text-sm font-medium text-zinc-300">Marca</label>
        <select className={inputCls} value={brandId} onChange={(e) => setBrandId(e.target.value)} required>
          <option value="">Selecciona una marca...</option>
          {brands?.map((b: import('@/lib/growth/actions/brands').BrandBrainClient) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1.5 block font-roboto text-sm font-medium text-zinc-300">Formato</label>
        <div className="flex flex-wrap gap-2">
          {FORMAT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFormat(opt.value)}
              className={`rounded-lg px-3 py-1.5 font-roboto text-xs font-medium transition-colors ${
                format === opt.value
                  ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40'
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block font-roboto text-sm font-medium text-zinc-300">
          Objetivo del post <span className="text-red-400">*</span>
        </label>
        <textarea
          className={`${inputCls} resize-none`}
          rows={2}
          placeholder='ej. "Mostrar el antes y después de una rehabilitación dental"'
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          required
        />
      </div>

      <div>
        <label className="mb-1.5 block font-roboto text-sm font-medium text-zinc-300">
          Tema específico <span className="font-normal text-zinc-600">(opcional)</span>
        </label>
        <input
          className={inputCls}
          placeholder='ej. "Temporada de bodas", "Día de la madre"'
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />
      </div>

      <div className="flex items-center justify-between rounded-xl border border-zinc-800/60 p-3">
        <div>
          <p className="font-roboto text-sm font-medium text-zinc-300">Generar imagen con IA</p>
          <p className="font-roboto text-xs text-zinc-600">+{CREDIT_COSTS.post_image_flux - 0} créditos extra · Flux Schnell</p>
        </div>
        <button
          type="button"
          onClick={() => setWithImage((v) => !v)}
          className={`relative h-6 w-11 rounded-full transition-colors ${withImage ? 'bg-cyan-500' : 'bg-zinc-700'}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${withImage ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
          <p className="font-roboto text-sm text-red-400">{error}</p>
        </div>
      )}

      <Button
        type="submit"
        disabled={loading || !brandId || !objective.trim() || !affordable}
        className="w-full gap-2"
      >
        {loading ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Generando...</>
        ) : (
          <><Zap className="h-4 w-4" /> Generar ({cost} créditos)</>
        )}
      </Button>

      {credits && !affordable && (
        <p className="text-center font-roboto text-xs text-amber-400">
          Créditos insuficientes. Necesitas {cost}, tienes {credits.balance}.
        </p>
      )}
    </form>
  );
}
