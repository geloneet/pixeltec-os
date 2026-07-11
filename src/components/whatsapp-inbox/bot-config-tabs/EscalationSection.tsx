"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { BotConfigV2, EscalationReason } from "@/types/pixelbot-config";
import { SectionCard } from "./_shared";

const REASON_LABELS: Record<EscalationReason, string> = {
  lead: "Lead nuevo (dejó su número / quiere que le llamen)",
  escalate: "Pide hablar con un asesor",
  unknown: "El bot no sabe cómo responder",
};

const MESSAGE_MAX = 400;

interface Props {
  config: BotConfigV2;
  onChange: (patch: Partial<BotConfigV2>) => void;
}

/** Escalamiento determinista (ADR-001): mensaje único enviado al cliente por
 * motivo — nunca el texto libre del LLM, para no prometer un SLA no
 * autorizado. Ver flujo completo en NeuroPIXEL: PixelBot/flows/escalar-a-humano.md */
export function EscalationSection({ config, onChange }: Props) {
  const esc = config.escalation;

  function update<K extends keyof BotConfigV2["escalation"]>(
    key: K,
    value: BotConfigV2["escalation"][K]
  ) {
    onChange({ escalation: { ...esc, [key]: value } });
  }

  function updateMessage(reason: EscalationReason, value: string) {
    update("messages", { ...esc.messages, [reason]: value });
  }

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
      <SectionCard title="Umbrales">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300">
            Confianza mínima antes de escalar por duda (0.0–1.0)
          </label>
          <Input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={esc.confidence_threshold}
            onChange={(e) => update("confidence_threshold", Number(e.target.value))}
            className="h-8 w-24 border-zinc-800 bg-zinc-900/60 text-sm text-zinc-200"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300">
            Intentos de aclarar antes de escalar
          </label>
          <Input
            type="number"
            min={0}
            max={10}
            value={esc.max_clarify_attempts}
            onChange={(e) => update("max_clarify_attempts", Number(e.target.value))}
            className="h-8 w-20 border-zinc-800 bg-zinc-900/60 text-sm text-zinc-200"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-300">Prioridad de notificación a Miguel</label>
          <Input
            value={esc.priority}
            onChange={(e) => update("priority", e.target.value)}
            placeholder="normal"
            className="h-8 w-40 border-zinc-800 bg-zinc-900/60 text-sm text-zinc-200"
          />
        </div>
      </SectionCard>

      <SectionCard title="Mensajes por motivo (único mensaje enviado al cliente)">
        {(Object.keys(REASON_LABELS) as EscalationReason[]).map((reason) => (
          <div key={reason} className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300">{REASON_LABELS[reason]}</label>
            <Textarea
              value={esc.messages[reason]}
              onChange={(e) => updateMessage(reason, e.target.value)}
              maxLength={MESSAGE_MAX}
              className="min-h-[60px] border-zinc-800 bg-zinc-900/60 text-sm text-zinc-200"
            />
          </div>
        ))}
        <p className="text-[11px] text-zinc-500">
          Este es el único mensaje que recibe el cliente al escalar — nunca el texto libre que
          generó el LLM, para no prometer nada que Miguel no haya autorizado.
        </p>
      </SectionCard>
    </div>
  );
}
