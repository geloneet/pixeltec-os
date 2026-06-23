'use client';

import { X } from 'lucide-react';
import { PERSONALITY_TAGS, AVOID_TAGS, CONTENT_PILLARS } from '@/lib/growth/constants/brand-options';
import type { BrandBrain } from '@/types/growth/brand-brain';
import { cn } from '@/lib/utils';

interface Props {
  data: Partial<BrandBrain>;
  onChange: (updates: Partial<BrandBrain>) => void;
}

const inputCls = 'w-full rounded-xl border border-zinc-700/60 bg-zinc-800/50 px-3.5 py-2.5 font-roboto text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-colors focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block font-roboto text-sm font-medium text-zinc-300">{label}</label>
      {children}
    </div>
  );
}

function TagPicker({
  selected,
  options,
  max,
  onChange,
  customPlaceholder,
}: {
  selected: string[];
  options: string[];
  max: number;
  onChange: (tags: string[]) => void;
  customPlaceholder?: string;
}) {
  function toggle(tag: string) {
    if (selected.includes(tag)) {
      onChange(selected.filter((t) => t !== tag));
    } else if (selected.length < max) {
      onChange([...selected, tag]);
    }
  }

  function handleCustom(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && selected.length < max) {
      const val = e.currentTarget.value.trim();
      if (val && !selected.includes(val)) {
        onChange([...selected, val]);
        e.currentTarget.value = '';
      }
      e.preventDefault();
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {options.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => toggle(tag)}
            className={cn(
              'rounded-lg px-2.5 py-1 font-roboto text-xs transition-colors',
              selected.includes(tag)
                ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
            )}
          >
            {tag}
          </button>
        ))}
        {selected
          .filter((s) => !options.includes(s))
          .map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 rounded-lg bg-cyan-500/20 px-2.5 py-1 font-roboto text-xs text-cyan-300 ring-1 ring-cyan-500/40"
            >
              {tag}
              <button type="button" onClick={() => onChange(selected.filter((t) => t !== tag))}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
      </div>
      {customPlaceholder && selected.length < max && (
        <input className={inputCls} placeholder={customPlaceholder} onKeyDown={handleCustom} />
      )}
      <p className="font-roboto text-xs text-zinc-600">
        {selected.length}/{max} seleccionados
      </p>
    </div>
  );
}

export function Step4Voice({ data, onChange }: Props) {
  const voice = data.voice ?? { personality: [], avoid: [], language: 'es', formality: 'semi_formal', examplePosts: [], forbiddenTopics: [] };
  const rules = data.contentRules ?? { preferredFormats: ['instagram_post'], callToActions: [], contentPillars: [] };

  function updateVoice(updates: Partial<typeof voice>) {
    onChange({ voice: { ...voice, ...updates } });
  }
  function updateRules(updates: Partial<typeof rules>) {
    onChange({ contentRules: { ...rules, ...updates } });
  }

  function handleCTA(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && rules.callToActions.length < 5) {
      const val = e.currentTarget.value.trim();
      if (val && !rules.callToActions.includes(val)) {
        updateRules({ callToActions: [...rules.callToActions, val] });
        e.currentTarget.value = '';
      }
      e.preventDefault();
    }
  }

  return (
    <div className="space-y-6">
      <Field label="Personalidad de la marca (máx. 5)">
        <TagPicker selected={voice.personality} options={PERSONALITY_TAGS} max={5} onChange={(t) => updateVoice({ personality: t })} customPlaceholder="Otro rasgo → Enter" />
      </Field>

      <Field label="Qué evitar en el contenido (máx. 10)">
        <TagPicker selected={voice.avoid} options={AVOID_TAGS} max={10} onChange={(t) => updateVoice({ avoid: t })} customPlaceholder="Otro elemento a evitar → Enter" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Formalidad">
          <div className="flex gap-2">
            {[
              { value: 'formal', label: 'Formal' },
              { value: 'semi_formal', label: 'Semi-formal' },
              { value: 'casual', label: 'Casual' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => updateVoice({ formality: opt.value as typeof voice.formality })}
                className={cn(
                  'flex-1 rounded-xl border py-2 font-roboto text-xs font-medium transition-colors',
                  voice.formality === opt.value
                    ? 'border-cyan-500/60 bg-cyan-500/10 text-cyan-300'
                    : 'border-zinc-700/60 bg-zinc-800/50 text-zinc-500 hover:text-zinc-300'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Idioma principal">
          <div className="flex gap-2">
            {[
              { value: 'es', label: 'Español' },
              { value: 'en', label: 'English' },
              { value: 'pt', label: 'Português' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => updateVoice({ language: opt.value as typeof voice.language })}
                className={cn(
                  'flex-1 rounded-xl border py-2 font-roboto text-xs font-medium transition-colors',
                  voice.language === opt.value
                    ? 'border-cyan-500/60 bg-cyan-500/10 text-cyan-300'
                    : 'border-zinc-700/60 bg-zinc-800/50 text-zinc-500 hover:text-zinc-300'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </Field>
      </div>

      <Field label="Pilares de contenido">
        <TagPicker selected={rules.contentPillars} options={CONTENT_PILLARS} max={5} onChange={(p) => updateRules({ contentPillars: p })} />
      </Field>

      <Field label="Calls to action aprobados (máx. 5)">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {rules.callToActions.map((cta) => (
              <span key={cta} className="flex items-center gap-1 rounded-lg bg-zinc-800 px-2.5 py-1 font-roboto text-xs text-zinc-300">
                {cta}
                <button type="button" onClick={() => updateRules({ callToActions: rules.callToActions.filter((c) => c !== cta) })}>
                  <X className="h-3 w-3 text-zinc-500 hover:text-zinc-200" />
                </button>
              </span>
            ))}
          </div>
          {rules.callToActions.length < 5 && (
            <input className={inputCls} placeholder='ej. "Agenda tu consulta gratuita" → Enter' onKeyDown={handleCTA} />
          )}
        </div>
      </Field>

      <Field label="Ejemplos de posts que la marca aprueba (máx. 3)">
        <div className="space-y-2">
          {voice.examplePosts.map((post, i) => (
            <div key={i} className="flex gap-2">
              <textarea
                className={cn(inputCls, 'resize-none')}
                rows={2}
                value={post}
                onChange={(e) => {
                  const next = voice.examplePosts.map((p, idx) => idx === i ? e.target.value : p);
                  updateVoice({ examplePosts: next });
                }}
              />
              <button type="button" onClick={() => updateVoice({ examplePosts: voice.examplePosts.filter((_, idx) => idx !== i) })} className="text-zinc-600 hover:text-red-400">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          {voice.examplePosts.length < 3 && (
            <button
              type="button"
              onClick={() => updateVoice({ examplePosts: [...voice.examplePosts, ''] })}
              className="font-roboto text-xs text-cyan-400 hover:text-cyan-300"
            >
              + Agregar ejemplo de post
            </button>
          )}
        </div>
      </Field>
    </div>
  );
}
