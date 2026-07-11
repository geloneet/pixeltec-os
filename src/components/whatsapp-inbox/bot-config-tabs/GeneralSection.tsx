"use client";

import { cn } from "@/lib/utils";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import type { BotConfigV2 } from "@/types/pixelbot-config";
import type { BotSchedule, BotTone } from "@/types/whatsapp-inbox";
import { SectionCard, ListEditor } from "./_shared";

const TONE_OPTIONS: { value: BotTone; label: string; desc: string }[] = [
  { value: "formal", label: "Formal", desc: "Trato de usted, lenguaje cuidado y profesional." },
  { value: "cercano", label: "Cercano", desc: "Trato de tú, cálido y amigable." },
  { value: "tecnico", label: "Técnico", desc: "Directo, preciso, enfocado en detalles." },
  { value: "comercial", label: "Comercial", desc: "Orientado a venta, resalta beneficios." },
];

const DAY_LABELS = ["D", "L", "M", "M", "J", "V", "S"];
const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const BOT_NAME_MAX = 60;
const MESSAGE_MAX = 1000;
const DELAY_MIN = 0;
const DELAY_MAX = 600;

interface Props {
  config: BotConfigV2;
  onChange: (patch: Partial<BotConfigV2>) => void;
}

/** Identidad básica, horario, mensajes fijos y listas — el shape "legacy" de
 * bot_config, sin cambios de comportamiento respecto a la pantalla anterior. */
export function GeneralSection({ config, onChange }: Props) {
  function update<K extends keyof BotConfigV2>(key: K, value: BotConfigV2[K]) {
    onChange({ [key]: value } as Partial<BotConfigV2>);
  }

  function updateSchedule(patch: Partial<BotSchedule>) {
    onChange({ schedule: { ...config.schedule, ...patch } });
  }

  function toggleDay(day: number) {
    const has = config.schedule.days.includes(day);
    const next = has
      ? config.schedule.days.filter((d) => d !== day)
      : [...config.schedule.days, day].sort((a, b) => a - b);
    updateSchedule({ days: next });
  }

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
      {/* Identidad */}
      <SectionCard title="Identidad">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300">Nombre del bot</label>
          <Input
            value={config.bot_name}
            onChange={(e) => update("bot_name", e.target.value)}
            maxLength={BOT_NAME_MAX}
            placeholder="PixelBot"
            className="h-8 border-zinc-800 bg-zinc-900/60 text-sm text-zinc-200"
          />
          <p className="text-[11px] text-zinc-600">
            {config.bot_name.length}/{BOT_NAME_MAX}
          </p>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300">Tono</label>
          <Select value={config.tone} onValueChange={(v) => update("tone", v as BotTone)}>
            <SelectTrigger className="h-8 border-zinc-800 bg-zinc-900/60 text-xs text-zinc-300 focus:ring-cyan-500/20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-zinc-800/60 bg-zinc-900/95 backdrop-blur-xl">
              {TONE_OPTIONS.map((opt) => (
                <SelectItem
                  key={opt.value}
                  value={opt.value}
                  className="text-sm text-zinc-300 focus:bg-white/[0.06] focus:text-zinc-100"
                >
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-zinc-500">
            {TONE_OPTIONS.find((o) => o.value === config.tone)?.desc}
          </p>
        </div>
      </SectionCard>

      {/* Tiempos y horario */}
      <SectionCard title="Tiempos y horario">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300">Delay de respuesta (segundos)</label>
          <Input
            type="number"
            min={DELAY_MIN}
            max={DELAY_MAX}
            value={config.response_delay_seconds}
            onChange={(e) => update("response_delay_seconds", Number(e.target.value))}
            className="h-8 w-28 border-zinc-800 bg-zinc-900/60 text-sm text-zinc-200"
          />
          <p className="text-[11px] text-zinc-500">
            por defecto 30 — pausa antes de responder (ver también Política de respuesta para el
            delay humanizado por longitud)
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300">Días de atención</label>
          <div className="flex gap-1.5">
            {DAY_LABELS.map((label, idx) => {
              const active = config.schedule.days.includes(idx);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggleDay(idx)}
                  aria-label={DAY_NAMES[idx]}
                  aria-pressed={active}
                  title={DAY_NAMES[idx]}
                  className={cn(
                    "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40",
                    active
                      ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-300"
                      : "border-zinc-800 bg-zinc-900/60 text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {config.schedule.days.length === 0 && (
            <p className="text-[11px] text-amber-300/80">Sin días marcados = siempre abierto</p>
          )}
        </div>

        <div className="flex gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300">Inicio</label>
            <input
              type="time"
              value={config.schedule.start}
              onChange={(e) => updateSchedule({ start: e.target.value })}
              className="h-8 rounded-md border border-zinc-800 bg-zinc-900/60 px-2 text-sm text-zinc-200 [color-scheme:dark] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300">Fin</label>
            <input
              type="time"
              value={config.schedule.end}
              onChange={(e) => updateSchedule({ end: e.target.value })}
              className="h-8 rounded-md border border-zinc-800 bg-zinc-900/60 px-2 text-sm text-zinc-200 [color-scheme:dark] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
            />
          </div>
        </div>
        <p className="text-[11px] text-zinc-500">Hora de Vallarta</p>
      </SectionCard>

      {/* Mensajes */}
      <SectionCard title="Mensajes">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300">Mensaje fuera de horario</label>
          <Textarea
            value={config.out_of_hours_message}
            onChange={(e) => update("out_of_hours_message", e.target.value)}
            maxLength={MESSAGE_MAX}
            className="min-h-[70px] border-zinc-800 bg-zinc-900/60 text-sm text-zinc-200"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300">Mensaje inicial</label>
          <Textarea
            value={config.initial_message}
            onChange={(e) => update("initial_message", e.target.value)}
            maxLength={MESSAGE_MAX}
            className="min-h-[70px] border-zinc-800 bg-zinc-900/60 text-sm text-zinc-200"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300">
            Mensaje al escalar a humano (genérico, legacy)
          </label>
          <Textarea
            value={config.escalation_message}
            onChange={(e) => update("escalation_message", e.target.value)}
            maxLength={MESSAGE_MAX}
            className="min-h-[70px] border-zinc-800 bg-zinc-900/60 text-sm text-zinc-200"
          />
          <p className="text-[11px] text-zinc-500">
            Los mensajes por motivo (lead/asesor/duda) viven en la tab Escalamiento.
          </p>
        </div>
      </SectionCard>

      {/* Qué SÍ */}
      <SectionCard title="Qué SÍ puede responder">
        <ListEditor
          items={config.can_answer}
          onChange={(items) => update("can_answer", items)}
          accent="emerald"
        />
      </SectionCard>

      {/* Qué NO */}
      <SectionCard title="Qué NO puede responder">
        <ListEditor
          items={config.cannot_answer}
          onChange={(items) => update("cannot_answer", items)}
          accent="red"
        />
      </SectionCard>

      {/* Reglas de escalamiento (legacy, texto libre) */}
      <SectionCard title="Reglas de escalamiento a humano (legacy)">
        <ListEditor
          items={config.escalation_rules}
          onChange={(items) => update("escalation_rules", items)}
          accent="amber"
        />
      </SectionCard>

      {/* Cotización */}
      <SectionCard title="Preguntas obligatorias para cotización">
        <ListEditor
          hint="El orden importa: el bot las pregunta en este orden salvo que el cliente ya haya dado la información."
          items={config.quote_questions}
          onChange={(items) => update("quote_questions", items)}
        />
      </SectionCard>
    </div>
  );
}
