"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, RefreshCw, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { DirectionScores } from "@/lib/pixelforge/scores";
import type { Direccion } from "@/lib/pixelforge/schemas/generate-directions";

export type DirectionStatus = "candidate" | "chosen" | "discarded";

/**
 * Forma "empaquetada" de una dirección para renderizar la card — evita
 * importar `PackedDirectionScores` de `@/lib/db/repos/pixelforge` (repo con
 * imports pesados de drizzle/db) en un client component; se replica la misma
 * forma acá a partir de tipos livianos (`scores.ts` + `schemas/generate-directions.ts`,
 * sin dependencias de servidor).
 */
export interface PackedScoresView extends DirectionScores {
  scoresRazones: Direccion["scoresRazones"];
  risks: Direccion["risks"];
}

export interface DirectionCardView {
  id: string;
  slot: number;
  title: string;
  concept: string;
  designTokens: Direccion["designTokens"];
  motionDna: Direccion["motionDna"];
  signatureMotif: Direccion["signatureMotif"];
  signatureComponent: Direccion["signatureComponent"];
  scores: PackedScoresView;
  scoreTotal: number;
  status: DirectionStatus;
}

interface Props {
  direction: DirectionCardView;
  /** id→nombre de capabilities certificadas (`SIGNATURE_CAPABILITIES`) — resuelto por el caller (server component) para no arrastrar el registry acá. */
  capabilityNames: Record<string, string>;
  /** false cuando la decisión de dirección está sellada — oculta los botones de acción. */
  editable: boolean;
  regenerating?: boolean;
  /** true si CUALQUIER corrida (generación completa o regeneración de otro slot) está en curso — deshabilita los botones para evitar carreras. */
  actionsDisabled?: boolean;
  onRegenerate?: () => void;
  onChoose?: () => void;
}

const RITMO_LABEL: Record<Direccion["motionDna"]["ritmo"], string> = {
  lento: "Lento",
  moderado: "Moderado",
  rapido: "Rápido",
};

const INTENSIDAD_LABEL: Record<1 | 2 | 3, string> = {
  1: "Sutil",
  2: "Moderada",
  3: "Marcada",
};

const STATUS_BADGE: Partial<Record<DirectionStatus, { label: string; className: string }>> = {
  chosen: { label: "Elegida", className: "border-transparent bg-lime-500/15 text-lime-700 dark:text-lime-300" },
  discarded: { label: "Descartada", className: "border-transparent bg-secondary text-muted-foreground" },
};

const SCORE_BARS: { key: keyof DirectionScores; label: string; invert?: boolean }[] = [
  { key: "originalidadConceptual", label: "Originalidad conceptual" },
  { key: "independenciaDeReferencias", label: "Independencia de referencias" },
  { key: "especificidadDelMotif", label: "Especificidad del motif" },
  { key: "utilidadDelSignature", label: "Utilidad del signature" },
  { key: "riesgoGenericidadIA", label: "Riesgo de genericidad IA", invert: true },
];

const GENERIC_RISK_THRESHOLD = 60;

/**
 * Card de una dirección creativa (estación Direcciones, F5): título/concepto,
 * preview de design tokens, Motion DNA, signature motif, signature component
 * (capability certificada o desarrollo custom honesto), scores con razones
 * colapsables y `scoreTotal` prominente. El score SOLO ordena y alerta — nunca
 * decide por el usuario (ver leyenda en `DirectionsPanel`).
 */
export function DirectionCard({
  direction,
  capabilityNames,
  editable,
  regenerating,
  actionsDisabled,
  onRegenerate,
  onChoose,
}: Props) {
  const [confirmingRegen, setConfirmingRegen] = useState(false);
  const [showReasons, setShowReasons] = useState(false);

  const highGenericRisk = direction.scores.riesgoGenericidadIA >= GENERIC_RISK_THRESHOLD;
  const statusBadge = STATUS_BADGE[direction.status];

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-muted-foreground">Slot {direction.slot}</span>
            {statusBadge && <Badge className={statusBadge.className}>{statusBadge.label}</Badge>}
          </div>
          <h3 className="mt-1 text-base font-semibold text-foreground">{direction.title}</h3>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Score total</p>
          <p className="text-2xl font-bold text-cyan-500">{direction.scoreTotal}</p>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{direction.concept}</p>

      {highGenericRisk && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          Riesgo de genericidad IA alto ({direction.scores.riesgoGenericidadIA}/100) — revisa si de verdad se
          distingue de una plantilla.
        </div>
      )}

      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">Paleta y tipografía</p>
        <div className="flex flex-wrap gap-1.5">
          {direction.designTokens.paleta.map((token) => (
            <span
              key={token.token}
              title={`${token.token}: ${token.uso}`}
              className="flex items-center gap-1.5 rounded-full border border-border/60 bg-secondary/30 px-2 py-0.5 text-[11px] text-muted-foreground"
            >
              <span
                className="h-3 w-3 flex-shrink-0 rounded-full border border-border/40"
                style={{ backgroundColor: token.valor }}
              />
              {token.token}
            </span>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          {direction.designTokens.tipografia.display} / {direction.designTokens.tipografia.body}
        </p>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">Motion DNA</p>
        <p className="text-xs text-foreground">{direction.motionDna.personalidad}</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-secondary/40 px-2 py-0.5 text-[11px] text-muted-foreground">
            Ritmo: {RITMO_LABEL[direction.motionDna.ritmo]}
          </span>
          <span className="rounded-full bg-secondary/40 px-2 py-0.5 text-[11px] text-muted-foreground">
            Intensidad: {INTENSIDAD_LABEL[direction.motionDna.intensidadGlobal]}
          </span>
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">Signature motif</p>
        <p className="text-xs font-medium text-foreground">{direction.signatureMotif.nombre}</p>
        <p className="text-xs text-muted-foreground">{direction.signatureMotif.descripcion}</p>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">Signature component</p>
        {direction.signatureComponent.status === "capability" ? (
          <Badge variant="secondary">
            {capabilityNames[direction.signatureComponent.capabilityId] ??
              direction.signatureComponent.capabilityId}
          </Badge>
        ) : (
          <div className="space-y-1">
            <Badge className="border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300">
              Desarrollo custom requerido
            </Badge>
            <p className="text-[11px] text-muted-foreground">{direction.signatureComponent.businessValue}</p>
            <p className="text-[11px] text-muted-foreground">
              Complejidad estimada: {direction.signatureComponent.estimatedComplexity}
            </p>
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">Scores</p>
          <button
            type="button"
            onClick={() => setShowReasons((s) => !s)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            {showReasons ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Razones
          </button>
        </div>
        <div className="space-y-1.5">
          {SCORE_BARS.map((bar) => {
            const value = direction.scores[bar.key];
            return (
              <div key={bar.key}>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{bar.label}</span>
                  <span>{value}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary/50">
                  <div
                    className={`h-full rounded-full ${bar.invert ? "bg-amber-400" : "bg-cyan-400"}`}
                    style={{ width: `${value}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        {showReasons && (
          <p className="mt-2 rounded-md border border-border/60 bg-secondary/20 p-2 text-[11px] text-muted-foreground">
            {direction.scores.scoresRazones.porCriterio}
          </p>
        )}
      </div>

      {editable && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          {!confirmingRegen ? (
            <button
              type="button"
              onClick={() => setConfirmingRegen(true)}
              disabled={regenerating || actionsDisabled}
              className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${regenerating ? "animate-spin" : ""}`} />
              {regenerating ? "Regenerando…" : "Regenerar"}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-amber-600 dark:text-amber-400">Reemplaza esta dirección</span>
              <button
                type="button"
                onClick={() => {
                  setConfirmingRegen(false);
                  onRegenerate?.();
                }}
                className="rounded-md bg-amber-500 px-2.5 py-1 text-[11px] font-medium text-black transition-colors hover:bg-amber-400"
              >
                Confirmar
              </button>
              <button
                type="button"
                onClick={() => setConfirmingRegen(false)}
                className="text-[11px] text-muted-foreground hover:text-foreground"
              >
                Cancelar
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onChoose}
            disabled={actionsDisabled}
            className="ml-auto flex items-center gap-1.5 rounded-md bg-cyan-500 px-3 py-1.5 text-xs font-medium text-black transition-colors hover:bg-cyan-400 disabled:opacity-40"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Elegir esta dirección
          </button>
        </div>
      )}
    </div>
  );
}
