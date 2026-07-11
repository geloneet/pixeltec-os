"use client";

import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { BotConfigV2 } from "@/types/pixelbot-config";
import { SectionCard, ListEditor } from "./_shared";

const STYLE_MAX = 300;

function SwitchRow({
  label, checked, onCheckedChange,
}: { label: string; checked: boolean; onCheckedChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 py-1">
      <span className="text-xs text-zinc-300">{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </label>
  );
}

interface Props {
  config: BotConfigV2;
  onChange: (patch: Partial<BotConfigV2>) => void;
}

/** Política de respuesta (cómo se comporta el bot turno a turno) + timing
 * humanizado (cuánto tarda en responder). */
export function ResponsePolicySection({ config, onChange }: Props) {
  const rp = config.response_policy;
  const t = config.timing;

  function updatePolicy<K extends keyof BotConfigV2["response_policy"]>(
    key: K,
    value: BotConfigV2["response_policy"][K]
  ) {
    onChange({ response_policy: { ...rp, [key]: value } });
  }

  function updateTiming<K extends keyof BotConfigV2["timing"]>(
    key: K,
    value: BotConfigV2["timing"][K]
  ) {
    onChange({ timing: { ...t, [key]: value } });
  }

  const timingInvalid = t.min_delay_seconds >= t.max_delay_seconds;

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
      <SectionCard title="Reglas de conversación">
        <SwitchRow
          label="Una pregunta útil por turno"
          checked={rp.one_question_per_turn}
          onCheckedChange={(v) => updatePolicy("one_question_per_turn", v)}
        />
        <SwitchRow
          label="No repetir el saludo si ya hay conversación"
          checked={rp.no_repeat_greeting}
          onCheckedChange={(v) => updatePolicy("no_repeat_greeting", v)}
        />
        <SwitchRow
          label="No repetir datos ya conocidos (memoria)"
          checked={rp.no_repeat_known_data}
          onCheckedChange={(v) => updatePolicy("no_repeat_known_data", v)}
        />
        <SwitchRow
          label="Reconocer incertidumbre en vez de inventar"
          checked={rp.acknowledge_uncertainty}
          onCheckedChange={(v) => updatePolicy("acknowledge_uncertainty", v)}
        />
      </SectionCard>

      <SectionCard title="Longitud y contenido">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300">Preferencia de longitud</label>
          <Textarea
            value={rp.length_preference}
            onChange={(e) => updatePolicy("length_preference", e.target.value)}
            maxLength={STYLE_MAX}
            className="min-h-[60px] border-zinc-800 bg-zinc-900/60 text-sm text-zinc-200"
          />
        </div>
        <ListEditor
          label="Nunca inventar"
          hint="Ej. precios, fechas, alcances, compromisos, descuentos, disponibilidad"
          items={rp.no_invent}
          onChange={(items) => updatePolicy("no_invent", items)}
          accent="red"
          maxItemLen={60}
        />
      </SectionCard>

      <SectionCard title="Tiempo de respuesta humanizado">
        <div className="flex gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300">Mínimo (seg)</label>
            <Input
              type="number"
              min={0}
              max={600}
              value={t.min_delay_seconds}
              onChange={(e) => updateTiming("min_delay_seconds", Number(e.target.value))}
              className="h-8 w-24 border-zinc-800 bg-zinc-900/60 text-sm text-zinc-200"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300">Máximo (seg)</label>
            <Input
              type="number"
              min={0}
              max={600}
              value={t.max_delay_seconds}
              onChange={(e) => updateTiming("max_delay_seconds", Number(e.target.value))}
              className="h-8 w-24 border-zinc-800 bg-zinc-900/60 text-sm text-zinc-200"
            />
          </div>
        </div>
        {timingInvalid && (
          <p className="text-[11px] text-red-400">El mínimo debe ser menor que el máximo.</p>
        )}
        <SwitchRow
          label="Variar según la longitud de la respuesta"
          checked={t.vary_by_length}
          onCheckedChange={(v) => updateTiming("vary_by_length", v)}
        />
        <SwitchRow
          label="Desactivar pausa humanizada"
          checked={t.disabled}
          onCheckedChange={(v) => updateTiming("disabled", v)}
        />
      </SectionCard>
    </div>
  );
}
