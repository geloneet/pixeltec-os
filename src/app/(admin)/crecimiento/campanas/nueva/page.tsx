'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBrands } from '@/hooks/growth/use-brands';
import { createCampaign } from '@/lib/growth/actions/campaigns';
import type { Campaign } from '@/types/growth/campaign';

const inputCls = 'w-full rounded-xl border border-border bg-background px-3.5 py-2.5 font-roboto text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30';

const PLATFORM_OPTIONS: Array<{ value: Campaign['targetPlatforms'][number]; label: string }> = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'twitter', label: 'Twitter/X' },
];

export default function NuevaCampanaPage() {
  const router = useRouter();
  const { data: brands } = useBrands();

  const [brandId, setBrandId] = useState('');
  const [name, setName] = useState('');
  const [objective, setObjective] = useState('');
  const [targetAction, setTargetAction] = useState('');
  const [platforms, setPlatforms] = useState<Campaign['targetPlatforms']>(['instagram']);
  const [saving, setSaving] = useState(false);

  function togglePlatform(p: Campaign['targetPlatforms'][number]) {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!brandId || !name || !objective || !targetAction || platforms.length === 0) {
      toast.error('Completa todos los campos requeridos');
      return;
    }
    setSaving(true);
    try {
      const result = await createCampaign({ brandId, name, objective, targetAction, targetPlatforms: platforms });
      if (!result.ok) throw new Error(result.error);
      toast.success('Campaña creada');
      router.push(`/crecimiento/campanas/${result.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al crear');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8 lg:px-10">
      <nav className="mb-6">
        <Link href="/crecimiento/campanas" className="flex items-center gap-1.5 font-roboto text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Campañas
        </Link>
      </nav>

      <h1 className="mb-8 font-poppins text-3xl font-bold text-foreground">Nueva campaña</h1>

      <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-6 space-y-5">
        <div>
          <label className="mb-1.5 block font-roboto text-sm font-medium text-muted-foreground">Marca</label>
          <select className={inputCls} value={brandId} onChange={(e) => setBrandId(e.target.value)} required>
            <option value="">Selecciona una marca...</option>
            {brands?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block font-roboto text-sm font-medium text-muted-foreground">Nombre de la campaña</label>
          <input className={inputCls} placeholder='ej. "Campaña Día de la Madre 2026"' value={name} onChange={(e) => setName(e.target.value)} required />
        </div>

        <div>
          <label className="mb-1.5 block font-roboto text-sm font-medium text-muted-foreground">Objetivo de la campaña</label>
          <textarea className={`${inputCls} resize-none`} rows={2} placeholder='ej. "Generar 20 nuevas consultas de implantes dentales en mayo"' value={objective} onChange={(e) => setObjective(e.target.value)} required />
        </div>

        <div>
          <label className="mb-1.5 block font-roboto text-sm font-medium text-muted-foreground">Acción objetivo del usuario</label>
          <input className={inputCls} placeholder='ej. "Agendar consulta", "Llamar al consultorio"' value={targetAction} onChange={(e) => setTargetAction(e.target.value)} required />
        </div>

        <div>
          <label className="mb-2 block font-roboto text-sm font-medium text-muted-foreground">Plataformas objetivo</label>
          <div className="flex flex-wrap gap-2">
            {PLATFORM_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => togglePlatform(opt.value)}
                className={`rounded-lg px-3 py-1.5 font-roboto text-xs font-medium transition-colors ${
                  platforms.includes(opt.value)
                    ? 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 ring-1 ring-cyan-500/40'
                    : 'bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <Button type="submit" disabled={saving} className="w-full">
          {saving ? 'Creando...' : 'Crear campaña'}
        </Button>
      </form>
    </div>
  );
}
