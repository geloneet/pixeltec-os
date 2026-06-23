'use client';

import { useState } from 'react';
import { Upload, X } from 'lucide-react';
import { GOOGLE_FONTS_HEADING, GOOGLE_FONTS_BODY } from '@/lib/growth/constants/brand-options';
import type { BrandBrain } from '@/types/growth/brand-brain';
import { cn } from '@/lib/utils';

interface Props {
  data: Partial<BrandBrain>;
  onChange: (updates: Partial<BrandBrain>) => void;
  brandId?: string;
}

const inputCls = 'w-full rounded-xl border border-zinc-700/60 bg-zinc-800/50 px-3.5 py-2.5 font-roboto text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-colors focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30';

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1.5 block font-roboto text-xs font-medium text-zinc-400">{label}</label>
      <div className="flex gap-2">
        <input
          type="color"
          value={value || '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded-lg border border-zinc-700/60 bg-transparent p-0.5"
        />
        <input
          className={cn(inputCls, 'flex-1')}
          value={value || ''}
          placeholder="#000000"
          onChange={(e) => onChange(e.target.value)}
          maxLength={7}
        />
      </div>
    </div>
  );
}

export function Step5Visual({ data, onChange, brandId }: Props) {
  const identity = data.identity ?? {
    colors: { primary: '#1A2B3C', secondary: '#F5F5F5', accent: '#22d3ee', background: '#0F0F12', text: '#F4F4F5' },
    typography: { heading: 'Poppins', body: 'Inter' },
  };
  const [uploading, setUploading] = useState(false);

  function updateColors(updates: Partial<typeof identity.colors>) {
    onChange({ identity: { ...identity, colors: { ...identity.colors, ...updates } } });
  }
  function updateTypo(updates: Partial<typeof identity.typography>) {
    onChange({ identity: { ...identity, typography: { ...identity.typography, ...updates } } });
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('El logo no puede superar 5MB');
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      if (brandId) form.append('brandId', brandId);
      const res = await fetch('/api/growth/brands/logo', { method: 'POST', body: form });
      if (!res.ok) throw new Error('Upload failed');
      const { url } = (await res.json()) as { url: string };
      onChange({ identity: { ...identity, logoUrl: url } });
    } catch {
      alert('Error al subir el logo. Intenta de nuevo.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <label className="mb-2 block font-roboto text-sm font-medium text-zinc-300">
          Logo de la marca (opcional)
        </label>
        {identity.logoUrl ? (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={identity.logoUrl} alt="Logo" className="h-16 w-16 rounded-xl object-contain bg-zinc-800 p-2" />
            <button
              type="button"
              onClick={() => onChange({ identity: { ...identity, logoUrl: undefined } })}
              className="flex items-center gap-1.5 font-roboto text-xs text-red-400 hover:text-red-300"
            >
              <X className="h-3.5 w-3.5" /> Quitar logo
            </button>
          </div>
        ) : (
          <label className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700/60 p-8 transition-colors hover:border-zinc-600',
            uploading && 'opacity-50 cursor-not-allowed'
          )}>
            <Upload className="h-6 w-6 text-zinc-600" />
            <span className="font-roboto text-sm text-zinc-500">
              {uploading ? 'Subiendo...' : 'Subir logo (PNG, SVG, JPG — máx. 5MB)'}
            </span>
            <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploading} />
          </label>
        )}
      </div>

      <div>
        <p className="mb-3 font-roboto text-sm font-medium text-zinc-300">Paleta de colores</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <ColorField label="Color primario *" value={identity.colors?.primary ?? ''} onChange={(v) => updateColors({ primary: v })} />
          <ColorField label="Color secundario" value={identity.colors?.secondary ?? ''} onChange={(v) => updateColors({ secondary: v })} />
          <ColorField label="Acento / Highlight" value={identity.colors?.accent ?? ''} onChange={(v) => updateColors({ accent: v })} />
          <ColorField label="Fondo" value={identity.colors?.background ?? ''} onChange={(v) => updateColors({ background: v })} />
          <ColorField label="Texto" value={identity.colors?.text ?? ''} onChange={(v) => updateColors({ text: v })} />
        </div>
      </div>

      <div>
        <p className="mb-3 font-roboto text-sm font-medium text-zinc-300">Tipografía</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block font-roboto text-xs font-medium text-zinc-400">Fuente de títulos</label>
            <select className={inputCls} value={identity.typography?.heading ?? 'Poppins'} onChange={(e) => updateTypo({ heading: e.target.value })}>
              {GOOGLE_FONTS_HEADING.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block font-roboto text-xs font-medium text-zinc-400">Fuente de cuerpo</label>
            <select className={inputCls} value={identity.typography?.body ?? 'Inter'} onChange={(e) => updateTypo({ body: e.target.value })}>
              {GOOGLE_FONTS_BODY.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-3 rounded-xl border border-zinc-800/60 p-4">
          <p style={{ fontFamily: identity.typography?.heading || 'Poppins' }} className="text-lg font-bold text-zinc-100">
            {data.name || 'Nombre de la marca'}
          </p>
          <p style={{ fontFamily: identity.typography?.body || 'Inter' }} className="mt-1 text-sm text-zinc-400">
            Así se verá el texto de tus publicaciones.
          </p>
        </div>
      </div>
    </div>
  );
}
