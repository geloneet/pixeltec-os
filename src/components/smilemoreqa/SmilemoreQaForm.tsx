'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, Plus, Trash2 } from 'lucide-react';
import { submitSmilemoreQa, type SmilemoreQaFormInput } from '@/app/actions';
import {
  FRECUENCIA_OPTIONS,
  HOW_TO_ANSWER,
  IMPACTO_OPTIONS,
  INTAKE_FIELDS,
  PRIORIDAD_OPTIONS,
  QUESTIONNAIRE_META,
  SECTIONS,
  type IncidentRow,
  type ModuleItem,
  type PriorityRow,
  type SimpleItem,
} from '@/lib/smilemore-qa/definition';

const DRAFT_KEY = 'smilemoreqa-draft-v1';
const MAX_INCIDENTS = 8;
const OTHER = 'Otro';

interface FormState {
  nombre: string;
  puesto: string;
  puestoOtro: string;
  sucursal: string;
  uso: string;
  respuestas: Record<string, string>;
  respuestasOtro: Record<string, string>;
  multiples: Record<string, string[]>;
  modulos: Record<string, { observacion: string; prioridad: string }>;
  incidencias: IncidentRow[];
  prioridades: PriorityRow[];
}

const INITIAL_STATE: FormState = {
  nombre: '',
  puesto: '',
  puestoOtro: '',
  sucursal: '',
  uso: '',
  respuestas: {},
  respuestasOtro: {},
  multiples: {},
  modulos: {},
  incidencias: [{}],
  prioridades: [{}, {}, {}, {}, {}],
};

/** "Otro" + texto → "Otro: <texto>"; opción normal pasa tal cual. */
function resolveOther(value: string, otherText: string): string {
  if (value !== OTHER) return value;
  const extra = otherText.trim();
  return extra ? `${OTHER}: ${extra}` : OTHER;
}

function prune(record: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(record).filter(([, v]) => v.trim() !== ''));
}

export function SmilemoreQaForm() {
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loaded = useRef(false);

  // Borrador local: cargar al montar…
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as Partial<FormState>;
        setForm((prev) => ({ ...prev, ...draft }));
      }
    } catch {
      // borrador corrupto — se ignora, el formulario arranca vacío
    }
    loaded.current = true;
  }, []);

  // …y autoguardar (debounced) en cada cambio para que nada se pierda.
  useEffect(() => {
    if (!loaded.current || done) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
      } catch {
        // storage lleno/bloqueado — el autoguardado es best-effort
      }
    }, 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [form, done]);

  function update(partial: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...partial }));
  }

  function setRespuesta(id: string, value: string) {
    setForm((prev) => ({ ...prev, respuestas: { ...prev.respuestas, [id]: value } }));
  }

  function setModulo(id: string, partial: Partial<{ observacion: string; prioridad: string }>) {
    setForm((prev) => {
      const current = prev.modulos[id] ?? { observacion: '', prioridad: '' };
      return {
        ...prev,
        modulos: { ...prev.modulos, [id]: { ...current, ...partial } },
      };
    });
  }

  function toggleMultiple(id: string, option: string) {
    setForm((prev) => {
      const current = prev.multiples[id] ?? [];
      const next = current.includes(option)
        ? current.filter((o) => o !== option)
        : [...current, option];
      return { ...prev, multiples: { ...prev.multiples, [id]: next } };
    });
  }

  function setIncident(index: number, partial: Partial<IncidentRow>) {
    setForm((prev) => ({
      ...prev,
      incidencias: prev.incidencias.map((row, i) => (i === index ? { ...row, ...partial } : row)),
    }));
  }

  function setPriority(index: number, partial: Partial<PriorityRow>) {
    setForm((prev) => ({
      ...prev,
      prioridades: prev.prioridades.map((row, i) => (i === index ? { ...row, ...partial } : row)),
    }));
  }

  async function handleSubmit() {
    if (form.nombre.trim().length < 2) {
      setNameError('Escribe tu nombre para poder darle seguimiento a tus respuestas.');
      document.getElementById('smqa-nombre')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setNameError(null);
    setError(null);
    setSubmitting(true);

    const respuestas = { ...form.respuestas };
    for (const [id, otherText] of Object.entries(form.respuestasOtro)) {
      if ((respuestas[id] ?? '') === OTHER) {
        respuestas[id] = resolveOther(OTHER, otherText);
      }
    }

    const payload: SmilemoreQaFormInput = {
      nombre: form.nombre.trim(),
      puesto: form.puesto ? resolveOther(form.puesto, form.puestoOtro) : undefined,
      sucursal: form.sucursal || undefined,
      uso: form.uso || undefined,
      respuestas: prune(respuestas),
      multiples: Object.fromEntries(
        Object.entries(form.multiples).filter(([, v]) => v.length > 0)
      ),
      modulos: Object.fromEntries(
        Object.entries(form.modulos)
          .map(
            ([id, m]) =>
              [
                id,
                {
                  observacion: m.observacion.trim() || undefined,
                  prioridad: m.prioridad || undefined,
                },
              ] as const
          )
          .filter(([, m]) => m.observacion || m.prioridad)
      ),
      incidencias: form.incidencias.filter((row) =>
        Object.values(row).some((v) => (v ?? '').trim() !== '')
      ),
      prioridades: form.prioridades.filter((row) =>
        Object.values(row).some((v) => (v ?? '').trim() !== '')
      ),
    };

    try {
      const result = await submitSmilemoreQa(payload);
      if (result.ok) {
        try {
          window.localStorage.removeItem(DRAFT_KEY);
        } catch {
          // best-effort
        }
        setDone(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setError(result.message);
      }
    } catch {
      setError('No se pudo enviar. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 sm:p-12 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-400" />
        <h1 className="mt-6 text-2xl sm:text-3xl font-bold">¡Gracias! Tus respuestas fueron enviadas.</h1>
        <p className="mt-3 text-zinc-400 leading-relaxed">
          El equipo de PixelTEC ya recibió tu cuestionario. Con esta información vamos a
          priorizar las correcciones y adaptaciones del sistema de citas de Smile More.
        </p>
        <p className="mt-6 text-sm text-zinc-500">Puedes cerrar esta página.</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void handleSubmit();
      }}
      className="space-y-8"
    >
      {/* Portada */}
      <header className="rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 p-6 sm:p-10">
        <p className="text-xs font-bold tracking-[0.3em] text-zinc-500">PIXELTEC</p>
        <h1 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight">
          {QUESTIONNAIRE_META.title}
        </h1>
        <p className="mt-2 text-blue-400 font-medium">{QUESTIONNAIRE_META.subtitle}</p>
        <p className="mt-6 text-xs uppercase tracking-widest text-zinc-500">Cliente</p>
        <p className="text-xl font-bold">{QUESTIONNAIRE_META.client}</p>
        <p className="mt-4 text-sm text-zinc-400 leading-relaxed">{QUESTIONNAIRE_META.objective}</p>
        <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
          <p className="text-sm font-semibold text-zinc-200 mb-2">Cómo responder</p>
          <ul className="space-y-1.5">
            {HOW_TO_ANSWER.map((line) => (
              <li key={line} className="text-sm text-zinc-400 flex gap-2">
                <span className="text-blue-400 shrink-0">•</span>
                {line}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-zinc-500">
            Tus avances se guardan automáticamente en este dispositivo: puedes pausar y regresar
            cuando quieras, y enviar al terminar.
          </p>
        </div>
      </header>

      {/* Datos del levantamiento */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 sm:p-7 space-y-6">
        <h2 className="text-lg font-bold">Datos del levantamiento</h2>
        <div>
          <label htmlFor="smqa-nombre" className="block text-sm font-semibold text-zinc-200 mb-1.5">
            Nombre de quien responde <span className="text-blue-400">*</span>
          </label>
          <input
            id="smqa-nombre"
            type="text"
            value={form.nombre}
            onChange={(e) => update({ nombre: e.target.value })}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none"
            placeholder="Ej. Dra. Polett Niebla"
            autoComplete="name"
          />
          {nameError && <p className="mt-1.5 text-sm text-red-400">{nameError}</p>}
        </div>

        <PillGroup
          label={INTAKE_FIELDS.puesto.label}
          options={[...INTAKE_FIELDS.puesto.options, OTHER]}
          value={form.puesto}
          onChange={(v) => update({ puesto: v })}
        />
        {form.puesto === OTHER && (
          <input
            type="text"
            value={form.puestoOtro}
            onChange={(e) => update({ puestoOtro: e.target.value })}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none"
            placeholder="¿Cuál es tu puesto?"
          />
        )}

        <PillGroup
          label={INTAKE_FIELDS.sucursal.label}
          options={INTAKE_FIELDS.sucursal.options}
          value={form.sucursal}
          onChange={(v) => update({ sucursal: v })}
        />
        <PillGroup
          label={INTAKE_FIELDS.uso.label}
          options={INTAKE_FIELDS.uso.options}
          value={form.uso}
          onChange={(v) => update({ uso: v })}
        />
      </section>

      {/* Secciones 01-07 */}
      {SECTIONS.map((section) => (
        <section key={section.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 sm:p-7">
          <div className="flex items-baseline gap-3">
            <span className="text-blue-400 font-extrabold text-xl">{section.num}</span>
            <h2 className="text-lg sm:text-xl font-bold">{section.title}</h2>
          </div>
          <p className="mt-2 text-sm text-zinc-400 leading-relaxed">{section.intro}</p>

          {section.id === 'priorizacion' && (
            <div className="mt-6 space-y-4">
              <p className="text-sm font-semibold text-zinc-200">Los cinco cambios más importantes</p>
              {form.prioridades.map((row, i) => (
                <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 space-y-3">
                  <p className="text-sm font-bold text-blue-400">Prioridad {i + 1}</p>
                  <FieldInput
                    label="Cambio solicitado"
                    value={row.cambio ?? ''}
                    onChange={(v) => setPriority(i, { cambio: v })}
                  />
                  <FieldInput
                    label="Problema que resuelve"
                    value={row.problema ?? ''}
                    onChange={(v) => setPriority(i, { problema: v })}
                  />
                  <FieldInput
                    label="Para quién es importante"
                    value={row.paraQuien ?? ''}
                    onChange={(v) => setPriority(i, { paraQuien: v })}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 space-y-7">
            {section.items.map((item) =>
              item.type === 'module-block' ? (
                <ModuleBlock
                  key={item.id}
                  item={item}
                  value={form.modulos[item.id] ?? { observacion: '', prioridad: '' }}
                  onObservacion={(v) => setModulo(item.id, { observacion: v })}
                  onPrioridad={(v) => setModulo(item.id, { prioridad: v })}
                />
              ) : (
                <SimpleField
                  key={item.id}
                  item={item}
                  value={form.respuestas[item.id] ?? ''}
                  otherValue={form.respuestasOtro[item.id] ?? ''}
                  selected={form.multiples[item.id] ?? []}
                  onChange={(v) => setRespuesta(item.id, v)}
                  onOtherChange={(v) =>
                    setForm((prev) => ({
                      ...prev,
                      respuestasOtro: { ...prev.respuestasOtro, [item.id]: v },
                    }))
                  }
                  onToggle={(option) => toggleMultiple(item.id, option)}
                />
              )
            )}
          </div>

          {section.id === 'diagnostico' && (
            <div className="mt-8">
              <p className="text-sm font-semibold text-zinc-200">Registro rápido de incidencias</p>
              <p className="mt-1 text-xs text-zinc-500">
                Usa estas tarjetas para los errores más claros que ya hayas detectado. Si tienes
                capturas de pantalla, puedes enviarlas por WhatsApp aparte.
              </p>
              <div className="mt-4 space-y-4">
                {form.incidencias.map((row, i) => (
                  <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-blue-400">Incidencia {i + 1}</p>
                      {form.incidencias.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            update({ incidencias: form.incidencias.filter((_, j) => j !== i) })
                          }
                          className="text-zinc-500 hover:text-red-400 transition-colors"
                          aria-label={`Eliminar incidencia ${i + 1}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <FieldInput label="Sección del sistema" value={row.seccion ?? ''} onChange={(v) => setIncident(i, { seccion: v })} />
                    <FieldInput label="Qué estabas haciendo" value={row.haciendo ?? ''} onChange={(v) => setIncident(i, { haciendo: v })} />
                    <FieldInput label="Qué esperabas" value={row.esperabas ?? ''} onChange={(v) => setIncident(i, { esperabas: v })} />
                    <FieldInput label="Qué ocurrió / error" value={row.ocurrio ?? ''} onChange={(v) => setIncident(i, { ocurrio: v })} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <MiniPillGroup
                        label="Frecuencia"
                        options={FRECUENCIA_OPTIONS}
                        value={row.frecuencia ?? ''}
                        onChange={(v) => setIncident(i, { frecuencia: v })}
                      />
                      <MiniPillGroup
                        label="Impacto"
                        options={IMPACTO_OPTIONS}
                        value={row.impacto ?? ''}
                        onChange={(v) => setIncident(i, { impacto: v })}
                      />
                    </div>
                  </div>
                ))}
              </div>
              {form.incidencias.length < MAX_INCIDENTS && (
                <button
                  type="button"
                  onClick={() => update({ incidencias: [...form.incidencias, {}] })}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:border-blue-500 hover:text-blue-300 transition-colors"
                >
                  <Plus className="h-4 w-4" /> Agregar otra incidencia
                </button>
              )}
            </div>
          )}
        </section>
      ))}

      {/* Envío */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 sm:p-7">
        {error && (
          <p className="mb-4 rounded-lg border border-red-900 bg-red-950/50 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed px-6 py-4 text-base font-bold transition-colors inline-flex items-center justify-center gap-2"
        >
          {submitting && <Loader2 className="h-5 w-5 animate-spin" />}
          {submitting ? 'Enviando…' : 'Enviar cuestionario a PixelTEC'}
        </button>
        <p className="mt-3 text-center text-xs text-zinc-500">
          No es necesario responder todo: envía lo que tengas y podremos revisarlo juntos después.
        </p>
      </div>
    </form>
  );
}

/* ── Subcomponentes ──────────────────────────────────────────────────────── */

function PillGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-zinc-200 mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = value === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(active ? '' : option)}
              aria-pressed={active}
              className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                active
                  ? 'border-blue-500 bg-blue-500/15 text-blue-300'
                  : 'border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MiniPillGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-zinc-400 mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const active = value === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(active ? '' : option)}
              aria-pressed={active}
              className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                active
                  ? 'border-blue-500 bg-blue-500/15 text-blue-300'
                  : 'border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FieldInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-zinc-400 mb-1.5">{label}</p>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none"
      />
    </div>
  );
}

function ModuleBlock({
  item,
  value,
  onObservacion,
  onPrioridad,
}: {
  item: ModuleItem;
  value: { observacion: string; prioridad: string };
  onObservacion: (v: string) => void;
  onPrioridad: (v: string) => void;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 overflow-hidden">
      <div className="bg-zinc-900 px-4 py-2.5 border-b border-zinc-800">
        <p className="font-bold text-sm">{item.module}</p>
      </div>
      <div className="p-4 space-y-3">
        <p className="text-xs text-zinc-500 leading-relaxed">
          <span className="text-blue-400 font-semibold">Qué comprende: </span>
          {item.scope}
        </p>
        <div>
          <p className="text-sm font-semibold text-zinc-200 mb-1.5">{item.label}</p>
          {item.hint && <p className="text-xs italic text-zinc-500 mb-2">{item.hint}</p>}
          <textarea
            value={value.observacion}
            onChange={(e) => onObservacion(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none resize-y"
            placeholder="Escribe aquí…"
          />
        </div>
        <MiniPillGroup
          label="Prioridad"
          options={PRIORIDAD_OPTIONS}
          value={value.prioridad}
          onChange={onPrioridad}
        />
      </div>
    </div>
  );
}

function SimpleField({
  item,
  value,
  otherValue,
  selected,
  onChange,
  onOtherChange,
  onToggle,
}: {
  item: SimpleItem;
  value: string;
  otherValue: string;
  selected: string[];
  onChange: (v: string) => void;
  onOtherChange: (v: string) => void;
  onToggle: (option: string) => void;
}) {
  if (item.type === 'checkbox-group') {
    return (
      <div>
        <p className="text-sm font-semibold text-zinc-200 mb-1.5">{item.label}</p>
        {item.hint && <p className="text-xs italic text-zinc-500 mb-2">{item.hint}</p>}
        <div className="flex flex-wrap gap-2">
          {(item.options ?? []).map((option) => {
            const active = selected.includes(option);
            return (
              <button
                key={option}
                type="button"
                onClick={() => onToggle(option)}
                aria-pressed={active}
                className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                  active
                    ? 'border-blue-500 bg-blue-500/15 text-blue-300'
                    : 'border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (item.type === 'radio' || item.type === 'radio-other') {
    const options = item.type === 'radio-other' ? [...(item.options ?? []), OTHER] : (item.options ?? []);
    return (
      <div>
        <p className="text-sm font-semibold text-zinc-200 mb-1.5">{item.label}</p>
        {item.hint && <p className="text-xs italic text-zinc-500 mb-2">{item.hint}</p>}
        <div className="flex flex-wrap gap-2">
          {options.map((option) => {
            const active = value === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => onChange(active ? '' : option)}
                aria-pressed={active}
                className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                  active
                    ? 'border-blue-500 bg-blue-500/15 text-blue-300'
                    : 'border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
        {item.type === 'radio-other' && value === OTHER && (
          <input
            type="text"
            value={otherValue}
            onChange={(e) => onOtherChange(e.target.value)}
            className="mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none"
            placeholder="Especifica…"
          />
        )}
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm font-semibold text-zinc-200 mb-1.5">{item.label}</p>
      {item.hint && <p className="text-xs italic text-zinc-500 mb-2">{item.hint}</p>}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none resize-y"
        placeholder="Escribe aquí…"
      />
    </div>
  );
}
