'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Trash2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { BrandService } from '@/types/growth/brand-brain';

interface Props {
  service: BrandService;
  onChange: (service: BrandService) => void;
  onDelete: () => void;
  canHighlight: boolean;
}

const inputCls = 'w-full rounded-xl border border-zinc-700/60 bg-zinc-800/50 px-3 py-2 font-roboto text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-colors focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30';

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block font-roboto text-xs font-medium text-zinc-400">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}

export function ServiceEditor({ service, onChange, onDelete, canHighlight }: Props) {
  const [open, setOpen] = useState(!service.name);

  return (
    <div
      className={cn(
        'rounded-xl border bg-zinc-900/40 transition-colors',
        service.isHighlight ? 'border-cyan-500/40' : 'border-zinc-800/60'
      )}
    >
      <div className="flex items-center gap-2 p-3">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex flex-1 items-center gap-2 text-left"
        >
          {open ? (
            <ChevronUp className="h-4 w-4 shrink-0 text-zinc-500" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500" />
          )}
          <span className="font-roboto text-sm font-medium text-zinc-200">
            {service.name || 'Nuevo servicio'}
          </span>
          {service.isHighlight && (
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
          )}
        </button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => onChange({ ...service, isHighlight: !service.isHighlight })}
          disabled={!service.isHighlight && !canHighlight}
          title={service.isHighlight ? 'Quitar como destacado' : 'Marcar como servicio estrella'}
          className={cn(
            'h-7 w-7',
            service.isHighlight
              ? 'text-amber-400 hover:text-amber-300'
              : 'text-zinc-600 hover:text-amber-400'
          )}
        >
          <Star className={cn('h-3.5 w-3.5', service.isHighlight && 'fill-amber-400')} />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={onDelete}
          className="h-7 w-7 text-zinc-600 hover:text-red-400"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {open && (
        <div className="grid gap-3 border-t border-zinc-800/60 p-3 sm:grid-cols-2">
          <Field label="Nombre del servicio" required>
            <input
              className={inputCls}
              placeholder="ej. Implantes dentales"
              value={service.name}
              onChange={(e) => onChange({ ...service, name: e.target.value })}
            />
          </Field>
          <Field label="Precio referencial (opcional)">
            <input
              className={inputCls}
              placeholder="ej. Desde $15,000 MXN"
              value={service.price ?? ''}
              onChange={(e) => onChange({ ...service, price: e.target.value })}
            />
          </Field>
          <Field label="Descripción breve" required>
            <input
              className={inputCls}
              placeholder="ej. Reemplazo permanente de dientes perdidos"
              value={service.description}
              onChange={(e) => onChange({ ...service, description: e.target.value })}
            />
          </Field>
          <Field label="Duración (opcional)">
            <input
              className={inputCls}
              placeholder="ej. 1-3 sesiones"
              value={service.duration ?? ''}
              onChange={(e) => onChange({ ...service, duration: e.target.value })}
            />
          </Field>
          <Field label="Dolor que resuelve" required>
            <input
              className={inputCls}
              placeholder="ej. Vergüenza de sonreír por dientes faltantes"
              value={service.targetPain}
              onChange={(e) => onChange({ ...service, targetPain: e.target.value })}
            />
          </Field>
          <Field label="Beneficio principal" required>
            <input
              className={inputCls}
              placeholder="ej. Sonrisa natural y permanente en semanas"
              value={service.benefit}
              onChange={(e) => onChange({ ...service, benefit: e.target.value })}
            />
          </Field>
        </div>
      )}
    </div>
  );
}
