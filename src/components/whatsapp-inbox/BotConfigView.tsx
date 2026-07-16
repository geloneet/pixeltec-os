"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type {
  BotConfig,
  BotEmojiLevel,
  BotEmojiUsage,
  BotEscalation,
  BotEscalationMessages,
  BotFormality,
  BotPersonality,
  BotResponsePolicy,
  BotSchedule,
  BotTiming,
  BotTone,
} from "@/types/whatsapp-inbox";

const TONE_OPTIONS: { value: BotTone; label: string; desc: string }[] = [
  { value: "formal", label: "Formal", desc: "Trato de usted, lenguaje cuidado y profesional." },
  { value: "cercano", label: "Cercano", desc: "Trato de tú, cálido y amigable." },
  { value: "tecnico", label: "Técnico", desc: "Directo, preciso, enfocado en detalles." },
  { value: "comercial", label: "Comercial", desc: "Orientado a venta, resalta beneficios." },
];

const FORMALITY_OPTIONS: { value: BotFormality; label: string }[] = [
  { value: "formal", label: "Formal" },
  { value: "casual_profesional", label: "Casual profesional" },
  { value: "tecnico", label: "Técnico" },
];

const EMOJI_LEVEL_OPTIONS: { value: BotEmojiLevel; label: string }[] = [
  { value: "ninguno", label: "Ninguno" },
  { value: "bajo", label: "Bajo" },
  { value: "medio", label: "Medio" },
];

const IDENTITY_MAX = 80;
const SHORT_STYLE_MAX = 300;
const ESCALATION_MSG_MAX = 400;
const EMOJI_MAX_COUNT = 3;
const CLARIFY_ATTEMPTS_MAX = 10;
const TIMING_DELAY_MAX = 120;

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
    <div className="space-y-3 rounded-xl border border-border p-3">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

type ListAccent = "default" | "emerald" | "red" | "amber";

const ACCENT_CLASSES: Record<ListAccent, string> = {
  default: "border-border bg-muted text-muted-foreground",
  emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  red: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
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
    if (items.includes(trimmed)) {
      setInput("");
      return;
    }
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
      {label && <p className="text-xs font-medium text-muted-foreground">{label}</p>}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      <div className="flex flex-wrap gap-1.5">
        {items.length === 0 && <span className="text-xs text-muted-foreground/60">Sin elementos</span>}
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
              className="rounded-sm opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
          className="h-8 border-border bg-secondary/40 text-sm text-foreground"
        />
        <span className="flex-shrink-0 text-[11px] text-muted-foreground/60">
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

  function updatePersonality(patch: Partial<BotPersonality>) {
    setConfig((prev) => (prev?.personality ? { ...prev, personality: { ...prev.personality, ...patch } } : prev));
  }

  function updateEmojiUsage(patch: Partial<BotEmojiUsage>) {
    setConfig((prev) =>
      prev?.personality
        ? { ...prev, personality: { ...prev.personality, emoji_usage: { ...prev.personality.emoji_usage, ...patch } } }
        : prev
    );
  }

  function updateResponsePolicy(patch: Partial<BotResponsePolicy>) {
    setConfig((prev) => (prev?.response_policy ? { ...prev, response_policy: { ...prev.response_policy, ...patch } } : prev));
  }

  function updateEscalation(patch: Partial<BotEscalation>) {
    setConfig((prev) => (prev?.escalation ? { ...prev, escalation: { ...prev.escalation, ...patch } } : prev));
  }

  function updateEscalationMessages(patch: Partial<BotEscalationMessages>) {
    setConfig((prev) =>
      prev?.escalation
        ? { ...prev, escalation: { ...prev.escalation, messages: { ...prev.escalation.messages, ...patch } } }
        : prev
    );
  }

  function updateTiming(patch: Partial<BotTiming>) {
    setConfig((prev) => (prev?.timing ? { ...prev, timing: { ...prev.timing, ...patch } } : prev));
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
    if (
      config.schedule.days.length > 0 &&
      config.schedule.start &&
      config.schedule.end &&
      config.schedule.start >= config.schedule.end
    ) {
      toast.error("La hora de inicio debe ser menor que la hora de fin (horarios overnight no están soportados)");
      return;
    }
    if (config.personality) {
      const identity = config.personality.public_identity.trim();
      if (!identity || identity.length > IDENTITY_MAX) {
        toast.error(`La identidad pública debe tener entre 1 y ${IDENTITY_MAX} caracteres`);
        return;
      }
      const maxCount = config.personality.emoji_usage.max_count;
      if (!Number.isInteger(maxCount) || maxCount < 0 || maxCount > EMOJI_MAX_COUNT) {
        toast.error(`El máximo de emojis debe ser un entero entre 0 y ${EMOJI_MAX_COUNT}`);
        return;
      }
    }
    if (config.escalation) {
      const threshold = config.escalation.confidence_threshold;
      if (typeof threshold !== "number" || Number.isNaN(threshold) || threshold < 0 || threshold > 1) {
        toast.error("El umbral de confianza para escalar debe ser un número entre 0 y 1");
        return;
      }
      const attempts = config.escalation.max_clarify_attempts;
      if (!Number.isInteger(attempts) || attempts < 0 || attempts > CLARIFY_ATTEMPTS_MAX) {
        toast.error(`Los intentos de aclaración deben ser un entero entre 0 y ${CLARIFY_ATTEMPTS_MAX}`);
        return;
      }
    }
    if (config.timing) {
      const { min_delay_seconds: minD, max_delay_seconds: maxD } = config.timing;
      const inRange = (n: number) => Number.isInteger(n) && n >= 0 && n <= TIMING_DELAY_MAX;
      if (!inRange(minD) || !inRange(maxD)) {
        toast.error(`Los tiempos de espera deben ser enteros entre 0 y ${TIMING_DELAY_MAX} segundos`);
        return;
      }
      if (minD >= maxD) {
        toast.error("El tiempo mínimo de espera debe ser menor que el máximo");
        return;
      }
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
        <Spinner size="md" className="text-muted-foreground" />
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-sm text-muted-foreground">No se pudo cargar la configuración del bot.</p>
        {error && <p className="max-w-md text-xs text-muted-foreground/60">{error}</p>}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void loadConfig()}
          className="border-border bg-secondary/40 text-xs text-muted-foreground hover:bg-secondary/60"
        >
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="scrollbar-soft min-h-0 flex-1 overflow-y-auto p-4 pb-6">
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          {/* Identidad */}
          <SectionCard title="Identidad">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Nombre del bot</label>
              <Input
                value={config.bot_name}
                onChange={(e) => update("bot_name", e.target.value)}
                maxLength={BOT_NAME_MAX}
                placeholder="PixelBot"
                className="h-8 border-border bg-secondary/40 text-sm text-foreground"
              />
              <p className="text-[11px] text-muted-foreground/60">
                {config.bot_name.length}/{BOT_NAME_MAX}
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Tono</label>
              <Select value={config.tone} onValueChange={(v) => update("tone", v as BotTone)}>
                <SelectTrigger className="h-8 border-border bg-secondary/40 text-xs text-foreground focus:ring-cyan-500/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-border bg-popover/95 backdrop-blur-xl">
                  {TONE_OPTIONS.map((opt) => (
                    <SelectItem
                      key={opt.value}
                      value={opt.value}
                      className="text-sm text-popover-foreground focus:bg-secondary focus:text-foreground"
                    >
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                {TONE_OPTIONS.find((o) => o.value === config.tone)?.desc}
              </p>
            </div>
          </SectionCard>

          {/* Tiempos y horario */}
          <SectionCard title="Tiempos y horario">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Delay de respuesta (segundos)</label>
              <Input
                type="number"
                min={DELAY_MIN}
                max={DELAY_MAX}
                value={config.response_delay_seconds}
                onChange={(e) => update("response_delay_seconds", Number(e.target.value))}
                className="h-8 w-28 border-border bg-secondary/40 text-sm text-foreground"
              />
              <p className="text-[11px] text-muted-foreground">
                por defecto 30 — pausa humanizada antes de responder
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Días de atención</label>
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
                          ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-700 dark:text-cyan-300"
                          : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {config.schedule.days.length === 0 && (
                <p className="text-[11px] text-amber-700 dark:text-amber-300/80">
                  Sin días marcados = siempre abierto
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Inicio</label>
                <input
                  type="time"
                  value={config.schedule.start}
                  onChange={(e) => updateSchedule({ start: e.target.value })}
                  className="h-8 rounded-md border border-border bg-secondary/40 px-2 text-sm text-foreground dark:[color-scheme:dark] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Fin</label>
                <input
                  type="time"
                  value={config.schedule.end}
                  onChange={(e) => updateSchedule({ end: e.target.value })}
                  className="h-8 rounded-md border border-border bg-secondary/40 px-2 text-sm text-foreground dark:[color-scheme:dark] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">Hora de Vallarta</p>
          </SectionCard>

          {/* Mensajes */}
          <SectionCard title="Mensajes">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Mensaje fuera de horario</label>
              <Textarea
                value={config.out_of_hours_message}
                onChange={(e) => update("out_of_hours_message", e.target.value)}
                maxLength={MESSAGE_MAX}
                className="min-h-[70px] border-border bg-secondary/40 text-sm text-foreground"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Mensaje inicial</label>
              <Textarea
                value={config.initial_message}
                onChange={(e) => update("initial_message", e.target.value)}
                maxLength={MESSAGE_MAX}
                className="min-h-[70px] border-border bg-secondary/40 text-sm text-foreground"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Mensaje al escalar a humano</label>
              <Textarea
                value={config.escalation_message}
                onChange={(e) => update("escalation_message", e.target.value)}
                maxLength={MESSAGE_MAX}
                className="min-h-[70px] border-border bg-secondary/40 text-sm text-foreground"
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

          {config.personality && (
            <>
              {/* Personalidad */}
              <SectionCard title="Personalidad">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Identidad pública</label>
                  <Input
                    value={config.personality.public_identity}
                    onChange={(e) => updatePersonality({ public_identity: e.target.value })}
                    maxLength={IDENTITY_MAX}
                    placeholder="Equipo PixelTEC"
                    className="h-8 border-border bg-secondary/40 text-sm text-foreground"
                  />
                  <p className="text-[11px] text-muted-foreground/60">
                    Nunca puede afirmar ser Miguel ni una persona real — debe ser una identidad de equipo.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Formalidad</label>
                  <Select
                    value={config.personality.formality}
                    onValueChange={(v) => updatePersonality({ formality: v as BotFormality })}
                  >
                    <SelectTrigger className="h-8 border-border bg-secondary/40 text-xs text-foreground focus:ring-cyan-500/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-border bg-popover/95 backdrop-blur-xl">
                      {FORMALITY_OPTIONS.map((opt) => (
                        <SelectItem
                          key={opt.value}
                          value={opt.value}
                          className="text-sm text-popover-foreground focus:bg-secondary focus:text-foreground"
                        >
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <ListEditor
                  label="Rasgos"
                  items={config.personality.traits}
                  onChange={(items) => updatePersonality({ traits: items })}
                />
              </SectionCard>

              {/* Estilo de conversación */}
              <SectionCard title="Estilo de conversación">
                <ListEditor
                  label="Frases preferidas"
                  items={config.personality.preferred_phrases}
                  onChange={(items) => updatePersonality({ preferred_phrases: items })}
                  accent="emerald"
                />
                <ListEditor
                  label="Frases prohibidas"
                  items={config.personality.forbidden_phrases}
                  onChange={(items) => updatePersonality({ forbidden_phrases: items })}
                  accent="red"
                />
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Estilo de saludo</label>
                  <Textarea
                    value={config.personality.greeting_style}
                    onChange={(e) => updatePersonality({ greeting_style: e.target.value })}
                    maxLength={SHORT_STYLE_MAX}
                    className="min-h-[50px] border-border bg-secondary/40 text-sm text-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Estilo de despedida</label>
                  <Textarea
                    value={config.personality.farewell_style}
                    onChange={(e) => updatePersonality({ farewell_style: e.target.value })}
                    maxLength={SHORT_STYLE_MAX}
                    className="min-h-[50px] border-border bg-secondary/40 text-sm text-foreground"
                  />
                </div>
              </SectionCard>

              {/* Emojis */}
              <SectionCard title="Uso de emojis">
                <div className="flex gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Nivel</label>
                    <Select
                      value={config.personality.emoji_usage.level}
                      onValueChange={(v) => updateEmojiUsage({ level: v as BotEmojiLevel })}
                    >
                      <SelectTrigger className="h-8 w-32 border-border bg-secondary/40 text-xs text-foreground focus:ring-cyan-500/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-border bg-popover/95 backdrop-blur-xl">
                        {EMOJI_LEVEL_OPTIONS.map((opt) => (
                          <SelectItem
                            key={opt.value}
                            value={opt.value}
                            className="text-sm text-popover-foreground focus:bg-secondary focus:text-foreground"
                          >
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Máximo por mensaje</label>
                    <Input
                      type="number"
                      min={0}
                      max={EMOJI_MAX_COUNT}
                      value={config.personality.emoji_usage.max_count}
                      onChange={(e) => updateEmojiUsage({ max_count: Number(e.target.value) })}
                      className="h-8 w-20 border-border bg-secondary/40 text-sm text-foreground"
                    />
                  </div>
                </div>
                <ListEditor
                  label="Nunca usar emojis en"
                  items={config.personality.emoji_usage.never_in}
                  onChange={(items) => updateEmojiUsage({ never_in: items })}
                  accent="amber"
                />
              </SectionCard>
            </>
          )}

          {config.response_policy && (
            <SectionCard title="Política de respuesta">
              <div className="space-y-2">
                {(
                  [
                    ["one_question_per_turn", "Una pregunta por turno"],
                    ["no_repeat_greeting", "No repetir el saludo"],
                    ["no_repeat_known_data", "No repetir datos ya conocidos"],
                    ["acknowledge_uncertainty", "Reconocer incertidumbre"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <Switch
                      checked={config.response_policy![key]}
                      onCheckedChange={(checked) => updateResponsePolicy({ [key]: checked })}
                    />
                  </div>
                ))}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Preferencia de longitud</label>
                <Textarea
                  value={config.response_policy.length_preference}
                  onChange={(e) => updateResponsePolicy({ length_preference: e.target.value })}
                  maxLength={SHORT_STYLE_MAX}
                  className="min-h-[50px] border-border bg-secondary/40 text-sm text-foreground"
                />
              </div>
              <ListEditor
                label="Nunca inventar"
                items={config.response_policy.no_invent}
                onChange={(items) => updateResponsePolicy({ no_invent: items })}
                accent="red"
              />
            </SectionCard>
          )}

          {config.escalation && (
            <SectionCard title="Escalamiento (avanzado)">
              <div className="flex gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="escalation-threshold" className="text-xs font-medium text-muted-foreground">
                    Umbral de confianza para escalar
                  </label>
                  <Input
                    id="escalation-threshold"
                    aria-label="Umbral de confianza para escalar"
                    type="number"
                    min={0}
                    max={1}
                    step={0.05}
                    value={config.escalation.confidence_threshold}
                    onChange={(e) => updateEscalation({ confidence_threshold: Number(e.target.value) })}
                    className="h-8 w-24 border-border bg-secondary/40 text-sm text-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="escalation-attempts" className="text-xs font-medium text-muted-foreground">
                    Intentos de aclaración antes de escalar
                  </label>
                  <Input
                    id="escalation-attempts"
                    type="number"
                    min={0}
                    max={CLARIFY_ATTEMPTS_MAX}
                    value={config.escalation.max_clarify_attempts}
                    onChange={(e) => updateEscalation({ max_clarify_attempts: Number(e.target.value) })}
                    className="h-8 w-20 border-border bg-secondary/40 text-sm text-foreground"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Mensaje — lead (interés comercial)</label>
                <Textarea
                  value={config.escalation.messages.lead}
                  onChange={(e) => updateEscalationMessages({ lead: e.target.value })}
                  maxLength={ESCALATION_MSG_MAX}
                  className="min-h-[50px] border-border bg-secondary/40 text-sm text-foreground"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Mensaje — pide un asesor</label>
                <Textarea
                  value={config.escalation.messages.escalate}
                  onChange={(e) => updateEscalationMessages({ escalate: e.target.value })}
                  maxLength={ESCALATION_MSG_MAX}
                  className="min-h-[50px] border-border bg-secondary/40 text-sm text-foreground"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Mensaje — duda no resuelta</label>
                <Textarea
                  value={config.escalation.messages.unknown}
                  onChange={(e) => updateEscalationMessages({ unknown: e.target.value })}
                  maxLength={ESCALATION_MSG_MAX}
                  className="min-h-[50px] border-border bg-secondary/40 text-sm text-foreground"
                />
              </div>
            </SectionCard>
          )}

          {config.timing && (
            <SectionCard title="Tiempos de respuesta humanizados">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Variar según longitud del mensaje</span>
                <Switch
                  checked={config.timing.vary_by_length}
                  onCheckedChange={(checked) => updateTiming({ vary_by_length: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Desactivado (sin pausa humanizada)</span>
                <Switch
                  checked={config.timing.disabled}
                  onCheckedChange={(checked) => updateTiming({ disabled: checked })}
                />
              </div>
              <div className="flex gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Mínimo (segundos)</label>
                  <Input
                    type="number"
                    min={0}
                    max={TIMING_DELAY_MAX}
                    value={config.timing.min_delay_seconds}
                    onChange={(e) => updateTiming({ min_delay_seconds: Number(e.target.value) })}
                    className="h-8 w-20 border-border bg-secondary/40 text-sm text-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Máximo (segundos)</label>
                  <Input
                    type="number"
                    min={0}
                    max={TIMING_DELAY_MAX}
                    value={config.timing.max_delay_seconds}
                    onChange={(e) => updateTiming({ max_delay_seconds: Number(e.target.value) })}
                    className="h-8 w-20 border-border bg-secondary/40 text-sm text-foreground"
                  />
                </div>
              </div>
            </SectionCard>
          )}
        </div>

        <div className="mt-4 space-y-1 rounded-xl border border-border p-3 text-[11px] text-muted-foreground">
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
      <div className="flex flex-shrink-0 items-center justify-end gap-2 border-t border-border bg-card px-4 py-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleDiscard}
          disabled={!dirty || saving}
          className="h-8 text-xs text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
        >
          Descartar
        </Button>
        <Button
          type="button"
          onClick={() => void handleSave()}
          disabled={!dirty || saving}
          className="h-8 bg-cyan-600 text-xs text-white hover:bg-cyan-500"
        >
          {saving && <Spinner size="sm" />}
          Guardar cambios
        </Button>
      </div>
    </div>
  );
}
