'use client';

import { X, Plus } from 'lucide-react';
import type { BrandBrain } from '@/types/growth/brand-brain';

interface Props {
  data: Partial<BrandBrain>;
  onChange: (updates: Partial<BrandBrain>) => void;
}

const inputCls = 'w-full rounded-xl border border-zinc-700/60 bg-zinc-800/50 px-3.5 py-2.5 font-roboto text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-colors focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block font-roboto text-sm font-medium text-zinc-300">{label}</label>
      {children}
    </div>
  );
}

function TagInput({
  tags,
  placeholder,
  max,
  onChange,
}: {
  tags: string[];
  placeholder: string;
  max: number;
  onChange: (tags: string[]) => void;
}) {
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === 'Enter' || e.key === ',') && tags.length < max) {
      e.preventDefault();
      const val = e.currentTarget.value.trim();
      if (val && !tags.includes(val)) {
        onChange([...tags, val]);
        e.currentTarget.value = '';
      }
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 rounded-lg bg-zinc-800 px-2.5 py-1 font-roboto text-xs text-zinc-300"
          >
            {tag}
            <button type="button" onClick={() => onChange(tags.filter((t) => t !== tag))}>
              <X className="h-3 w-3 text-zinc-500 hover:text-zinc-200" />
            </button>
          </span>
        ))}
      </div>
      {tags.length < max && (
        <input
          className={inputCls}
          placeholder={placeholder}
          onKeyDown={handleKeyDown}
        />
      )}
      <p className="font-roboto text-xs text-zinc-600">
        Presiona Enter para agregar. {tags.length}/{max}
      </p>
    </div>
  );
}

export function Step3ICP({ data, onChange }: Props) {
  const pos = data.positioning ?? {
    valueProps: [],
    differentiators: [],
    targetAudience: { painPoints: [], goals: [], triggers: [] },
    pricePosition: 'mid_range' as const,
  };
  const icp = pos.targetAudience ?? { painPoints: [], goals: [], triggers: [] };
  const objections = data.objections ?? [];

  function updateICP(updates: Partial<typeof icp>) {
    onChange({ positioning: { ...pos, targetAudience: { ...icp, ...updates } } });
  }

  function addObjection() {
    if (objections.length >= 10) return;
    onChange({
      objections: [
        ...objections,
        { id: crypto.randomUUID(), objection: '', response: '' },
      ],
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-4 font-poppins text-sm font-semibold text-zinc-300">Cliente ideal (ICP)</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Rango de edad (opcional)">
            <input className={inputCls} placeholder="ej. 35-55 años" value={icp.ageRange ?? ''} onChange={(e) => updateICP({ ageRange: e.target.value })} />
          </Field>
          <Field label="Nivel de ingresos (opcional)">
            <input className={inputCls} placeholder="ej. Clase media-alta" value={icp.income ?? ''} onChange={(e) => updateICP({ income: e.target.value })} />
          </Field>
        </div>
        <div className="mt-4 space-y-4">
          <Field label="Dolores principales">
            <TagInput tags={icp.painPoints} placeholder="ej. No confía en dentistas → Enter" max={5} onChange={(t) => updateICP({ painPoints: t })} />
          </Field>
          <Field label="Objetivos del cliente">
            <TagInput tags={icp.goals} placeholder="ej. Sentirse seguro al sonreír → Enter" max={5} onChange={(t) => updateICP({ goals: t })} />
          </Field>
          <Field label="Disparadores de compra">
            <TagInput tags={icp.triggers} placeholder="ej. Boda próxima → Enter" max={5} onChange={(t) => updateICP({ triggers: t })} />
          </Field>
        </div>
      </div>

      <div>
        <p className="mb-3 font-poppins text-sm font-semibold text-zinc-300">Propuestas de valor</p>
        <TagInput tags={pos.valueProps} placeholder="ej. Garantía de 10 años en implantes → Enter" max={5} onChange={(v) => onChange({ positioning: { ...pos, valueProps: v } })} />
      </div>

      <div>
        <p className="mb-3 font-poppins text-sm font-semibold text-zinc-300">Diferenciadores</p>
        <TagInput tags={pos.differentiators} placeholder="ej. Único laboratorio propio → Enter" max={5} onChange={(d) => onChange({ positioning: { ...pos, differentiators: d } })} />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="font-poppins text-sm font-semibold text-zinc-300">
            Objeciones comunes y respuestas
          </p>
          <button
            type="button"
            onClick={addObjection}
            disabled={objections.length >= 10}
            className="flex items-center gap-1 font-roboto text-xs text-cyan-400 hover:text-cyan-300 disabled:text-zinc-700"
          >
            <Plus className="h-3.5 w-3.5" /> Agregar
          </button>
        </div>
        <div className="space-y-3">
          {objections.map((obj, i) => (
            <div key={obj.id} className="grid gap-2 rounded-xl border border-zinc-800/60 p-3 sm:grid-cols-2">
              <input
                className={inputCls}
                placeholder='ej. "Es muy caro"'
                value={obj.objection}
                onChange={(e) => {
                  const next = objections.map((o, idx) => idx === i ? { ...o, objection: e.target.value } : o);
                  onChange({ objections: next });
                }}
              />
              <div className="flex gap-2">
                <input
                  className={inputCls}
                  placeholder="ej. Tenemos planes sin intereses"
                  value={obj.response}
                  onChange={(e) => {
                    const next = objections.map((o, idx) => idx === i ? { ...o, response: e.target.value } : o);
                    onChange({ objections: next });
                  }}
                />
                <button type="button" onClick={() => onChange({ objections: objections.filter((_, idx) => idx !== i) })} className="text-zinc-600 hover:text-red-400">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          {objections.length === 0 && (
            <p className="font-roboto text-xs text-zinc-600">Agrega las objeciones más frecuentes de tus clientes.</p>
          )}
        </div>
      </div>
    </div>
  );
}
