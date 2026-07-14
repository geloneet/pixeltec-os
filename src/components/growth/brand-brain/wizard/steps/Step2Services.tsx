'use client';

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ServiceEditor } from '../ServiceEditor';
import type { BrandBrain, BrandService } from '@/types/growth/brand-brain';

interface Props {
  data: Partial<BrandBrain>;
  onChange: (updates: Partial<BrandBrain>) => void;
}

function newService(): BrandService {
  return {
    id: crypto.randomUUID(),
    name: '',
    description: '',
    targetPain: '',
    benefit: '',
    isHighlight: false,
  };
}

export function Step2Services({ data, onChange }: Props) {
  const services = data.business?.services ?? [];
  const biz = data.business ?? { industry: '', location: '', services: [], certifications: [] };

  function updateService(index: number, updated: BrandService) {
    const next = services.map((s, i) => (i === index ? updated : s));
    onChange({ business: { ...biz, services: next } });
  }

  function deleteService(index: number) {
    const next = services.filter((_, i) => i !== index);
    onChange({ business: { ...biz, services: next } });
  }

  function addService() {
    onChange({ business: { ...biz, services: [...services, newService()] } });
  }

  const hasHighlight = services.some((s) => s.isHighlight);

  return (
    <div className="space-y-3">
      <div className="mb-1 flex items-center justify-between">
        <p className="font-roboto text-sm text-muted-foreground">
          Define los servicios que ofreces.{' '}
          <span className="text-muted-foreground/70">Mínimo 1, máximo 10.</span>
        </p>
        <span className="font-roboto text-xs text-muted-foreground/70">{services.length}/10</span>
      </div>

      {services.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <p className="font-roboto text-sm text-muted-foreground/70">Aún no tienes servicios. Agrega al menos uno.</p>
        </div>
      )}

      {services.map((service, i) => (
        <ServiceEditor
          key={service.id}
          service={service}
          onChange={(updated) => updateService(i, updated)}
          onDelete={() => deleteService(i)}
          canHighlight={!hasHighlight || service.isHighlight}
        />
      ))}

      {services.length < 10 && (
        <Button
          type="button"
          variant="outline"
          onClick={addService}
          className="w-full gap-2 border-border text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
          Agregar servicio
        </Button>
      )}
    </div>
  );
}
