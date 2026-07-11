"use client";

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { BotConfigV2, BotFormality, EmojiLevel } from "@/types/pixelbot-config";
import { SectionCard, ListEditor } from "./_shared";

const FORMALITY_OPTIONS: { value: BotFormality; label: string }[] = [
  { value: "formal", label: "Formal" },
  { value: "casual_profesional", label: "Casual profesional" },
  { value: "tecnico", label: "Técnico" },
];

const EMOJI_LEVEL_OPTIONS: { value: EmojiLevel; label: string }[] = [
  { value: "ninguno", label: "Ninguno" },
  { value: "bajo", label: "Bajo" },
  { value: "medio", label: "Medio" },
];

const STYLE_MAX = 300;
const IDENTITY_MAX = 100;

interface Props {
  config: BotConfigV2;
  onChange: (patch: Partial<BotConfigV2>) => void;
}

/** Identidad pública, voz y tono fino del bot. `public_identity` nunca debe
 * afirmar ser una persona real (el backend lo rechaza en validación). */
export function PersonalitySection({ config, onChange }: Props) {
  const p = config.personality;

  function update<K extends keyof BotConfigV2["personality"]>(
    key: K,
    value: BotConfigV2["personality"][K]
  ) {
    onChange({ personality: { ...p, [key]: value } });
  }

  function updateEmoji(patch: Partial<BotConfigV2["personality"]["emoji_usage"]>) {
    update("emoji_usage", { ...p.emoji_usage, ...patch });
  }

  const identityLooksLikeMiguel = /miguel/i.test(p.public_identity);

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
      <SectionCard title="Identidad pública">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300">Cómo se presenta el bot</label>
          <Input
            value={p.public_identity}
            onChange={(e) => update("public_identity", e.target.value)}
            maxLength={IDENTITY_MAX}
            placeholder="Equipo PixelTEC"
            className="h-8 border-zinc-800 bg-zinc-900/60 text-sm text-zinc-200"
          />
          {identityLooksLikeMiguel && (
            <p className="text-[11px] text-red-400">
              No puede afirmar ser Miguel ni una persona real — el backend rechazará este valor al
              guardar.
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300">Variante de idioma</label>
          <Input
            value={p.language_variant}
            onChange={(e) => update("language_variant", e.target.value)}
            placeholder="es_MX"
            className="h-8 w-32 border-zinc-800 bg-zinc-900/60 text-sm text-zinc-200"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300">Formalidad</label>
          <Select value={p.formality} onValueChange={(v) => update("formality", v as BotFormality)}>
            <SelectTrigger className="h-8 border-zinc-800 bg-zinc-900/60 text-xs text-zinc-300 focus:ring-cyan-500/20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-zinc-800/60 bg-zinc-900/95 backdrop-blur-xl">
              {FORMALITY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-sm text-zinc-300">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </SectionCard>

      <SectionCard title="Rasgos de personalidad">
        <ListEditor
          items={p.traits}
          onChange={(items) => update("traits", items)}
          maxItemLen={60}
        />
      </SectionCard>

      <SectionCard title="Uso de emojis">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300">Nivel</label>
          <Select
            value={p.emoji_usage.level}
            onValueChange={(v) => updateEmoji({ level: v as EmojiLevel })}
          >
            <SelectTrigger className="h-8 border-zinc-800 bg-zinc-900/60 text-xs text-zinc-300 focus:ring-cyan-500/20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-zinc-800/60 bg-zinc-900/95 backdrop-blur-xl">
              {EMOJI_LEVEL_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-sm text-zinc-300">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300">Máximo por mensaje</label>
          <Input
            type="number"
            min={0}
            max={3}
            value={p.emoji_usage.max_count}
            onChange={(e) => updateEmoji({ max_count: Number(e.target.value) })}
            className="h-8 w-20 border-zinc-800 bg-zinc-900/60 text-sm text-zinc-200"
          />
        </div>
        <ListEditor
          label="Nunca usar emojis en"
          items={p.emoji_usage.never_in}
          onChange={(items) => updateEmoji({ never_in: items })}
          accent="red"
          maxItemLen={60}
        />
      </SectionCard>

      <SectionCard title="Listas y frases">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300">Cuándo usar listas</label>
          <Textarea
            value={p.lists_usage}
            onChange={(e) => update("lists_usage", e.target.value)}
            maxLength={STYLE_MAX}
            className="min-h-[60px] border-zinc-800 bg-zinc-900/60 text-sm text-zinc-200"
          />
        </div>
        <ListEditor
          label="Frases preferidas"
          items={p.preferred_phrases}
          onChange={(items) => update("preferred_phrases", items)}
          accent="emerald"
          maxItemLen={120}
        />
        <ListEditor
          label="Frases prohibidas"
          hint='Ej. "Estimado cliente", "Como inteligencia artificial"'
          items={p.forbidden_phrases}
          onChange={(items) => update("forbidden_phrases", items)}
          accent="red"
          maxItemLen={120}
        />
      </SectionCard>

      <SectionCard title="Estilo de conversación">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300">Saludo</label>
          <Textarea
            value={p.greeting_style}
            onChange={(e) => update("greeting_style", e.target.value)}
            maxLength={STYLE_MAX}
            className="min-h-[50px] border-zinc-800 bg-zinc-900/60 text-sm text-zinc-200"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300">Despedida</label>
          <Textarea
            value={p.farewell_style}
            onChange={(e) => update("farewell_style", e.target.value)}
            maxLength={STYLE_MAX}
            className="min-h-[50px] border-zinc-800 bg-zinc-900/60 text-sm text-zinc-200"
          />
        </div>
      </SectionCard>

      <SectionCard title="Manejo de errores y datos faltantes">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300">Reconocer un error/duda</label>
          <Textarea
            value={p.error_ack_style}
            onChange={(e) => update("error_ack_style", e.target.value)}
            maxLength={STYLE_MAX}
            className="min-h-[50px] border-zinc-800 bg-zinc-900/60 text-sm text-zinc-200"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300">Pedir un dato faltante</label>
          <Textarea
            value={p.ask_missing_data_style}
            onChange={(e) => update("ask_missing_data_style", e.target.value)}
            maxLength={STYLE_MAX}
            className="min-h-[50px] border-zinc-800 bg-zinc-900/60 text-sm text-zinc-200"
          />
        </div>
      </SectionCard>
    </div>
  );
}
