"use client";

import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { parseCanonical } from "@/lib/whatsapp-inbox/time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { BotConfig, BotSchedule, BotTone } from "@/types/whatsapp-inbox";

const TONE_OPTIONS: { value: BotTone; label: string; desc: string }[] = [
  { value: "formal", label: "Formal", desc: "Trato de usted, lenguaje cuidado y profesional." },
  { value: "cercano", label: "Cercano", desc: "Trato de tú, cálido y amigable." },
  { value: "tecnico", label: "Técnico", desc: "Directo, preciso, enfocado en detalles." },
  { value: "comercial", label: "Comercial", desc: "Orientado a venta, resalta beneficios." },
];

const DAY_LABELS = ["D", "L", "M", "M", "J", "V", "S"];
const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const MAX_ITEMS = 20;
const MAX_ITEM_LEN = 200;
const BOT_NAME_MAX = 60;
const MESSAGE_MAX = 1000;
const DELAY_MIN = 0;
const DELAY_MAX = 600;

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-xl border border-zinc-800/60 p-3">
      <p className="text-[11px] uppercase tracking-wider text-zinc-500">{title}</p>
      {children}
    </div>
  );
}

type ListAccent = "default" | "emerald" | "red" | "amber";

const ACCENT_CLASSES: Record<ListAccent, string> = {
  default: "border-zinc-700 bg-zinc-800/60 text-zinc-300",
  emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  red: "border-red-500/30 bg-red-500/10 text-red-300",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-300",
};

interface ListEditorProps {
  label?: string;
  hint?: string;
  items: string[];
  onChange: (items: string[]) => void;
  accent?: ListAccent;
}

function ListEditor({ label, hint, items, onChange, accent = "default" }: ListEditorProps) {
  const [input, setInput] = useState("");

  function handleAdd() {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (items.length >= MAX_ITEMS) {
      toast.error(`Máximo ${MAX_ITEMS} elementos en esta lista`);
      return;
    }
    if (trimmed.length > MAX_ITEM_LEN) {
      toast.error(`Máximo ${MAX_ITEM_LEN} caracteres por elemento`);
      return;
    }
    onChange([...items, trimmed]);
    setInput("");
  }

  function handleRemove(idx: number) {
    onChange(items.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-2">
      {label && <p className="text-xs font-medium text-zinc-300">{label}</p>}
      {hint && <p className="text-[11px] text-zinc-500">{hint}</p>}
      <div className="flex flex-wrap gap-1.5">
        {items.length === 0 && <span className="text-xs text-zinc-600">Sin elementos</span>}
        {items.map((item, idx) => (
          <Badge
            key={`${idx}-${item}`}
            variant="outline"
            className={cn("gap-1 font-normal", ACCENT_CLASSES[accent])}
          >
            <span className="max-w-[240px] truncate">{item}</span>
            <button
              type="button"
              onClick={() => handleRemove(idx)}
              aria-label={`Quitar "${item}"`}
              className="rounded-sm opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder="Escribe y presiona Enter…"
          maxLength={MAX_ITEM_LEN}
          className="h-8 border-zinc-800 bg-zinc-900/60 text-sm text-zinc-200"
        />
        <span className="flex-shrink-0 text-[11px] text-zinc-600">
          {items.length}/{MAX_ITEMS}
        </span>
      </div>
    </div>
  );
}

function extractErrorMessage(data: { error?: string; detail?: string }, status: number): string {
  return data.error ?? data.detail ?? `HTTP ${status}`;
}

function formatUpdatedAt(canonical: string): string {
  try {
    return parseCanonical(canonical).toLocaleString("es-MX", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return canonical;
  }
}

export function BotConfigView() {
  const [config, setConfig] = useState<BotConfig | null>(null);
  const [saved, setSaved] = useState<BotConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadConfig() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/whatsapp-inbox/config", { cache: "no-store" });
      const data = (await res.json()) as { config?: BotConfig; error?: string; detail?: string };
      if (!res.ok || !data.config) {
        throw new Error(extractErrorMessage(data, res.status));
      }
      setConfig(data.config);
      setSaved(data.config);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadConfig();
  }, []);

  const dirty = useMemo(() => {
    if (!config || !saved) return false;
    return JSON.stringify(config) !== JSON.stringify(saved);
  }, [config, saved]);

  function update<K extends keyof BotConfig>(key: K, value: BotConfig[K]) {
    setConfig((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function updateSchedule(patch: Partial<BotSchedule>) {
    setConfig((prev) => (prev ? { ...prev, schedule: { ...prev.schedule, ...patch } } : prev));
  }

  function toggleDay(day: number) {
    if (!config) return;
    const has = config.schedule.days.includes(day);
    const next = has
      ? config.schedule.days.filter((d) => d !== day)
      : [...config.schedule.days, day].sort((a, b) => a - b);
    updateSchedule({ days: next });
  }

  async function handleSave() {
    if (!config || saving) return;

    const trimmedName = config.bot_name.trim();
    if (!trimmedName || trimmedName.length > BOT_NAME_MAX) {
      toast.error(`El nombre del bot debe tener entre 1 y ${BOT_NAME_MAX} caracteres`);
      return;
    }
    if (
      !Number.isInteger(config.response_delay_seconds) ||
      config.response_delay_seconds < DELAY_MIN ||
      config.response_delay_seconds > DELAY_MAX
    ) {
      toast.error(`El delay debe ser un entero entre ${DELAY_MIN} y ${DELAY_MAX} segundos`);
      return;
    }
    if (config.schedule.days.length > 0 && (!config.schedule.start || !config.schedule.end)) {
      toast.error("Define hora de inicio y fin, o desmarca todos los días para siempre abierto");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/whatsapp-inbox/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      const data = (await res.json()) as { config?: BotConfig; error?: string; detail?: string };
      if (!res.ok || !data.config) {
        throw new Error(extractErrorMessage(data, res.status));
      }
      setConfig(data.config);
      setSaved(data.config);
      toast.success("El bot ya responde con la nueva configuración");
    } catch (err) {
      toast.error(`No se pudo guardar: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    if (saved) setConfig(saved);
  }

  if (loading) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center">
        <LoaderCircle className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-sm text-zinc-400">No se pudo cargar la configuración del bot.</p>
        {error && <p className="max-w-md text-xs text-zinc-600">{error}</p>}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void loadConfig()}
          className="border-zinc-800 bg-zinc-900/60 text-xs text-zinc-300 hover:bg-zinc-800/60"
        >
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-24">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
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
                default 30 — pausa humanizada antes de responder
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
                <p className="text-[11px] text-amber-300/80">
                  Sin días marcados = siempre abierto
                </p>
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
              <label className="text-xs font-medium text-zinc-300">Mensaje al escalar a humano</label>
              <Textarea
                value={config.escalation_message}
                onChange={(e) => update("escalation_message", e.target.value)}
                maxLength={MESSAGE_MAX}
                className="min-h-[70px] border-zinc-800 bg-zinc-900/60 text-sm text-zinc-200"
              />
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

          {/* Escalamiento */}
          <SectionCard title="Reglas de escalamiento a humano">
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

        <div className="mt-4 space-y-1 rounded-xl border border-zinc-800/60 p-3 text-[11px] text-zinc-500">
          <p>
            Los cambios aplican al siguiente mensaje que reciba el bot (cache ~60s). El prompt base
            de identidad PIXELTEC no se edita desde aquí.
          </p>
          {config.updated_at && (
            <p>
              Última edición: {formatUpdatedAt(config.updated_at)}
              {config.updated_by ? ` · ${config.updated_by}` : ""}
            </p>
          )}
        </div>
      </div>

      {/* Barra sticky */}
      <div className="flex flex-shrink-0 items-center justify-end gap-2 border-t border-zinc-800/60 bg-zinc-950/80 px-4 py-3 backdrop-blur-xl">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleDiscard}
          disabled={!dirty || saving}
          className="h-8 text-xs text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100"
        >
          Descartar
        </Button>
        <Button
          type="button"
          onClick={() => void handleSave()}
          disabled={!dirty || saving}
          className="h-8 bg-cyan-600 text-xs text-white hover:bg-cyan-500"
        >
          {saving && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
          Guardar cambios
        </Button>
      </div>
    </div>
  );
}
