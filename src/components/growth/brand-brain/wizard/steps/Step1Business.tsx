'use client';

import { INDUSTRIES } from '@/lib/growth/constants/brand-options';
import type { BrandBrain } from '@/types/growth/brand-brain';

interface Props {
  data: Partial<BrandBrain>;
  onChange: (updates: Partial<BrandBrain>) => void;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block font-roboto text-sm font-medium text-muted-foreground">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = 'w-full rounded-xl border border-border bg-background px-3.5 py-2.5 font-roboto text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30';

export function Step1Business({ data, onChange }: Props) {
  const biz = data.business ?? { industry: '', location: '', services: [], certifications: [] };

  return (
    <div className="space-y-5">
      <Field label="Nombre de la marca" required>
        <input
          className={inputCls}
          placeholder="ej. Clínica Dental Sur"
          value={data.name ?? ''}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </Field>

      <Field label="Industria / Sector" required>
        <select
          className={inputCls}
          value={biz.industry}
          onChange={(e) =>
            onChange({ business: { ...biz, industry: e.target.value } })
          }
        >
          <option value="">Selecciona una industria...</option>
          {INDUSTRIES.map((ind) => (
            <option key={ind} value={ind}>
              {ind}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Ubicación" required>
        <input
          className={inputCls}
          placeholder="ej. Guadalajara, México"
          value={biz.location}
          onChange={(e) =>
            onChange({ business: { ...biz, location: e.target.value } })
          }
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Sub-industria (opcional)">
          <input
            className={inputCls}
            placeholder="ej. Ortodoncia"
            value={biz.subIndustry ?? ''}
            onChange={(e) =>
              onChange({ business: { ...biz, subIndustry: e.target.value } })
            }
          />
        </Field>
        <Field label="Años en operación (opcional)">
          <input
            className={inputCls}
            type="number"
            min={0}
            max={100}
            placeholder="ej. 8"
            value={biz.yearsInBusiness ?? ''}
            onChange={(e) =>
              onChange({
                business: {
                  ...biz,
                  yearsInBusiness: e.target.value ? parseInt(e.target.value) : undefined,
                },
              })
            }
          />
        </Field>
      </div>
    </div>
  );
}
