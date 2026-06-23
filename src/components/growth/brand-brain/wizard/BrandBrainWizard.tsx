'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Save } from 'lucide-react';
import { WizardProgress } from './WizardProgress';
import { Step1Business } from './steps/Step1Business';
import { Step2Services } from './steps/Step2Services';
import { Step3ICP } from './steps/Step3ICP';
import { Step4Voice } from './steps/Step4Voice';
import { Step5Visual } from './steps/Step5Visual';
import { Button } from '@/components/ui/button';
import { createBrand, updateBrand } from '@/lib/growth/actions/brands';
import { computeBrandScore } from '@/lib/growth/utils/brand-score';
import type { BrandBrain } from '@/types/growth/brand-brain';
import type { BrandBrainClient } from '@/lib/growth/actions/brands';

const STEP_TITLES = [
  'Tu negocio',
  'Tus servicios',
  'Cliente ideal y posicionamiento',
  'Voz y comunicación',
  'Identidad visual',
];

const STEP_DESCRIPTIONS = [
  'Cuéntanos sobre tu empresa. Esta información contextualiza todo el contenido que generarás.',
  'Define los servicios que ofreces. La IA generará contenido sobre lo que más importa.',
  'Describe a tu cliente ideal y sus objeciones. Esto hace que el contenido sea relevante.',
  'Define cómo habla tu marca. El tono y estilo diferencian tu contenido.',
  'Añade los elementos visuales de tu marca. Opcionales, pero mejoran la consistencia.',
];

function getDefaultBrandBrain(): Omit<BrandBrain, 'id' | 'uid' | 'createdAt' | 'updatedAt'> {
  return {
    name: '',
    identity: {
      colors: { primary: '#1A2B3C', secondary: '#F5F5F5', accent: '#22d3ee', background: '#0F0F12', text: '#F4F4F5' },
      typography: { heading: 'Poppins', body: 'Inter' },
    },
    voice: {
      personality: [],
      avoid: [],
      language: 'es',
      formality: 'semi_formal',
      examplePosts: [],
      forbiddenTopics: [],
    },
    business: {
      industry: '',
      location: '',
      services: [],
      certifications: [],
    },
    positioning: {
      valueProps: [],
      differentiators: [],
      targetAudience: { painPoints: [], goals: [], triggers: [] },
      pricePosition: 'mid_range',
    },
    objections: [],
    contentRules: {
      preferredFormats: ['instagram_post'],
      callToActions: [],
      contentPillars: [],
    },
  };
}

interface Props {
  initialData?: BrandBrainClient;
  mode: 'create' | 'edit';
}

export function BrandBrainWizard({ initialData, mode }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<Omit<BrandBrain, 'id' | 'uid' | 'createdAt' | 'updatedAt'>>(
    initialData
      ? (({ id, uid, createdAt, updatedAt, completionScore, isComplete, isUsable, ...rest }) => rest)(initialData as BrandBrainClient & { isUsable?: boolean })
      : getDefaultBrandBrain()
  );

  function update(updates: Partial<BrandBrain>) {
    setData((prev) => ({ ...prev, ...updates }));
  }

  function validateStep(): string | null {
    if (step === 0) {
      if (!data.name?.trim()) return 'El nombre de la marca es requerido';
      if (!data.business?.industry) return 'La industria es requerida';
      if (!data.business?.location?.trim()) return 'La ubicación es requerida';
    }
    if (step === 1) {
      if (!data.business?.services?.length) return 'Agrega al menos un servicio';
      const incomplete = data.business.services.find(
        (s) => !s.name || !s.description || !s.targetPain || !s.benefit
      );
      if (incomplete) return `El servicio "${incomplete.name || 'sin nombre'}" tiene campos requeridos vacíos`;
    }
    return null;
  }

  function next() {
    const err = validateStep();
    if (err) { toast.error(err); return; }
    setStep((s) => Math.min(s + 1, 4));
  }

  async function save() {
    const err = validateStep();
    if (err) { toast.error(err); return; }
    setSaving(true);
    try {
      if (mode === 'create') {
        const result = await createBrand(data);
        if (!result.ok) throw new Error(result.error);
        toast.success('Brand Brain creado');
        router.push(`/crecimiento/brand-brain/${result.id}`);
      } else if (initialData) {
        const result = await updateBrand(initialData.id, data);
        if (!result.ok) throw new Error(result.error);
        toast.success('Brand Brain actualizado');
        router.push(`/crecimiento/brand-brain/${initialData.id}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  const isLastStep = step === 4;
  const score = computeBrandScore(data);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 flex justify-center">
        <WizardProgress currentStep={step} />
      </div>

      <div className="rounded-2xl border border-zinc-800/50 bg-zinc-900/40 p-6 backdrop-blur-xl sm:p-8">
        <div className="mb-6">
          <h2 className="font-poppins text-xl font-bold text-zinc-50">
            Paso {step + 1} — {STEP_TITLES[step]}
          </h2>
          <p className="mt-1 font-roboto text-sm text-zinc-500">{STEP_DESCRIPTIONS[step]}</p>
        </div>

        <div className="min-h-[300px]">
          {step === 0 && <Step1Business data={data} onChange={update} />}
          {step === 1 && <Step2Services data={data} onChange={update} />}
          {step === 2 && <Step3ICP data={data} onChange={update} />}
          {step === 3 && <Step4Voice data={data} onChange={update} />}
          {step === 4 && <Step5Visual data={data} onChange={update} brandId={initialData?.id} />}
        </div>

        <div className="mt-8 flex items-center justify-between border-t border-zinc-800/60 pt-6">
          <div className="flex items-center gap-4">
            {step > 0 && (
              <Button variant="ghost" onClick={() => setStep((s) => s - 1)} className="gap-2 text-zinc-400">
                <ArrowLeft className="h-4 w-4" />
                Anterior
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {score > 0 && (
              <span className="font-roboto text-xs text-zinc-600">
                Completitud: <span className="text-zinc-400">{score}%</span>
              </span>
            )}
            {isLastStep ? (
              <Button onClick={save} disabled={saving} className="gap-2">
                <Save className="h-4 w-4" />
                {saving ? 'Guardando...' : mode === 'create' ? 'Crear Brand Brain' : 'Guardar cambios'}
              </Button>
            ) : (
              <Button onClick={next} className="gap-2">
                Siguiente
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
