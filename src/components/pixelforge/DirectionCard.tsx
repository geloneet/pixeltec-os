"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, Compass, RefreshCw, Sparkles } from "lucide-react";
import { ForgeZone, type ForgeState } from "@/components/pixelforge/forge/ForgeZone";
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
  /**
   * Materialidad de la plancha según el status del artifact `direction_decision`
   * (docs/pixelforge/product-dna.md § Estados canónicos) — calculada por
   * `DirectionsPanel` con el mismo `zoneStateForArtifact` que el resto de
   * paneles reskineados (PF-X2 T3, calco de `ContextBriefPanel`/`LandingDnaPanel`/
   * `VisualDnaPanel`). Puramente presentacional (default "draft"): sin este
   * prop la card simplemente no refleja sealed/invalidated — no rompe
   * consumidores existentes (`DirectionCard.test.tsx` no lo pasa).
   */
  zoneState?: ForgeState;
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

/** Chip técnico (mono, DNA: "chips técnicos y números" → font-forge-mono). */
const CHIP_CLASS = "rounded-full px-2 py-0.5 font-forge-mono text-[10px] font-medium";

/**
 * Chips de status de la dirección. "Elegida" usa el acento (cobre) — es el
 * único uso de status que se lee como "actividad" (la dirección con la que se
 * sigue trabajando); "Descartada" queda neutra/apagada. `candidate` no
 * muestra chip (mismo comportamiento que el `Partial<>` original).
 */
const STATUS_CHIP: Partial<Record<DirectionStatus, { label: string; className: string }>> = {
  chosen: {
    label: "Elegida",
    className: `${CHIP_CLASS} bg-[hsl(var(--pfx-accent)/0.15)] text-pfx-accent`,
  },
  discarded: {
    label: "Descartada",
    className: `${CHIP_CLASS} bg-[hsl(var(--pfx-border)/0.4)] text-pfx-text-muted`,
  },
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
 * Card de una dirección creativa (estación Direcciones, F5 / reskin PF-X2 T3):
 * título/concepto, preview de design tokens, Motion DNA, signature motif,
 * signature component (capability certificada o desarrollo custom honesto),
 * scores con razones colapsables y `scoreTotal` prominente. El score SOLO
 * ordena y alerta — nunca decide por el usuario (ver leyenda en
 * `DirectionsPanel`). Las barras de score usan `--pfx-forge-sealed` (acero:
 * son mediciones ya calculadas por la IA, no actividad en curso) y
 * `--pfx-warning` para el riesgo invertido — el cobre queda reservado a la
 * dirección elegida (ver `highlightChosen` abajo), consistente con "una sola
 * fuente de calor" del DNA.
 *
 * IMPORTANTE (`ForgeZone`): su `forge-zone__content` interno NO es flex —
 * las utilidades de layout (flex/grid/gap) van en un `<div>` propio anidado
 * dentro de los children, nunca en el `className` de `ForgeZone` (ver
 * `docs/pixelforge/product-dna.md` y el resto de paneles reskineados).
 */
export function DirectionCard({
  direction,
  capabilityNames,
  editable,
  regenerating,
  actionsDisabled,
  onRegenerate,
  onChoose,
  zoneState = "draft",
}: Props) {
  const [confirmingRegen, setConfirmingRegen] = useState(false);
  const [showReasons, setShowReasons] = useState(false);

  const highGenericRisk = direction.scores.riesgoGenericidadIA >= GENERIC_RISK_THRESHOLD;
  const statusChip = STATUS_CHIP[direction.status];
  // La dirección elegida usa materialidad destacada (veta cobre) MIENTRAS la
  // decisión sigue sin sellar — "actividad" sancionada del acento (docs/pixelforge/
  // product-dna.md § visualPrinciples, "una sola fuente de calor"). Una vez
  // sellada, la card pasa de lleno a la materialidad fría/sólida (notch + veta
  // acero de `ForgeZone`) — el cobre no compite con lo ya sellado.
  const highlightChosen = direction.status === "chosen" && zoneState !== "sealed";

  return (
    <ForgeZone
      state={zoneState}
      className={`p-4${highlightChosen ? " ring-1 ring-pfx-accent/70" : ""}`}
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Compass className="h-3 w-3 flex-shrink-0 text-pfx-text-muted" aria-hidden="true" />
              <span className="font-forge-mono text-[11px] font-medium text-pfx-text-muted">
                Slot {direction.slot}
              </span>
              {statusChip && <span className={statusChip.className}>{statusChip.label}</span>}
            </div>
            <h3 className="mt-1 text-base font-semibold text-pfx-text">{direction.title}</h3>
          </div>
          <div className="flex-shrink-0 text-right">
            <p className="font-forge-mono text-[10px] uppercase tracking-wide text-pfx-text-muted">
              Score total
            </p>
            <p className="font-forge-mono text-2xl font-bold text-pfx-text">{direction.scoreTotal}</p>
          </div>
        </div>

        <p className="text-sm text-pfx-text-muted">{direction.concept}</p>

        {highGenericRisk && (
          <div className="flex items-start gap-2 rounded-[var(--pfx-radius)] border border-pfx-warning/30 bg-[hsl(var(--pfx-warning)/0.08)] px-3 py-2 text-xs text-pfx-warning">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
            Riesgo de genericidad IA alto ({direction.scores.riesgoGenericidadIA}/100) — revisa si de
            verdad se distingue de una plantilla.
          </div>
        )}

        <div>
          <p className="mb-1.5 text-xs font-medium text-pfx-text-muted">Paleta y tipografía</p>
          <div className="flex flex-wrap gap-1.5">
            {direction.designTokens.paleta.map((token) => (
              <span
                key={token.token}
                title={`${token.token}: ${token.uso}`}
                className="flex items-center gap-1.5 rounded-full border border-pfx-border bg-[hsl(var(--pfx-border)/0.3)] px-2 py-0.5 font-forge-mono text-[11px] text-pfx-text-muted"
              >
                {/*
                  El color viene crudo de la IA (hex arbitrario) — el anillo
                  border-pfx-border-strong + ring-inset blanco/negro semitransparente
                  asegura un borde legible en AMBOS temas sin importar cuán claro u
                  oscuro sea el swatch (mismo problema que un swatch blanco puro en
                  canvas claro, o negro puro en canvas oscuro).
                */}
                <span
                  className="h-3 w-3 flex-shrink-0 rounded-full border border-pfx-border-strong ring-1 ring-inset ring-black/10 dark:ring-white/20"
                  style={{ backgroundColor: token.valor }}
                />
                {token.token}
              </span>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-pfx-text-muted">
            {direction.designTokens.tipografia.display} / {direction.designTokens.tipografia.body}
          </p>
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-pfx-text-muted">Motion DNA</p>
          <p className="text-xs text-pfx-text">{direction.motionDna.personalidad}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <span className={`${CHIP_CLASS} bg-[hsl(var(--pfx-border)/0.4)] text-pfx-text-muted`}>
              Ritmo: {RITMO_LABEL[direction.motionDna.ritmo]}
            </span>
            <span className={`${CHIP_CLASS} bg-[hsl(var(--pfx-border)/0.4)] text-pfx-text-muted`}>
              Intensidad: {INTENSIDAD_LABEL[direction.motionDna.intensidadGlobal]}
            </span>
          </div>
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-pfx-text-muted">Signature motif</p>
          <p className="text-xs font-medium text-pfx-text">{direction.signatureMotif.nombre}</p>
          <p className="text-xs text-pfx-text-muted">{direction.signatureMotif.descripcion}</p>
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-pfx-text-muted">Signature component</p>
          {direction.signatureComponent.status === "capability" ? (
            <span className={`${CHIP_CLASS} bg-[hsl(var(--pfx-border)/0.4)] text-pfx-text`}>
              {capabilityNames[direction.signatureComponent.capabilityId] ??
                direction.signatureComponent.capabilityId}
            </span>
          ) : (
            <div className="space-y-1">
              <span className={`${CHIP_CLASS} bg-[hsl(var(--pfx-warning)/0.12)] text-pfx-warning`}>
                Desarrollo custom requerido
              </span>
              <p className="text-[11px] text-pfx-text-muted">
                {direction.signatureComponent.businessValue}
              </p>
              <p className="text-[11px] text-pfx-text-muted">
                Complejidad estimada: {direction.signatureComponent.estimatedComplexity}
              </p>
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-pfx-text-muted">Scores</p>
            <button
              type="button"
              onClick={() => setShowReasons((s) => !s)}
              className="flex items-center gap-1 text-[11px] text-pfx-text-muted transition-colors hover:text-pfx-text"
            >
              {showReasons ? (
                <ChevronUp className="h-3 w-3" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-3 w-3" aria-hidden="true" />
              )}
              Razones
            </button>
          </div>
          <div className="space-y-1.5">
            {SCORE_BARS.map((bar) => {
              const value = direction.scores[bar.key];
              return (
                <div key={bar.key}>
                  <div className="flex items-center justify-between text-[11px] text-pfx-text-muted">
                    <span>{bar.label}</span>
                    <span className="font-forge-mono">{value}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[hsl(var(--pfx-border)/0.5)]">
                    <div
                      className={`h-full rounded-full ${bar.invert ? "bg-pfx-warning" : "bg-pfx-forge-sealed"}`}
                      style={{ width: `${value}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {showReasons && (
            <p className="mt-2 rounded-[var(--pfx-radius)] border border-pfx-border bg-[hsl(var(--pfx-border)/0.2)] p-2 text-[11px] text-pfx-text-muted">
              {direction.scores.scoresRazones.porCriterio}
            </p>
          )}
        </div>

        {editable && (
          <div className="flex flex-wrap items-center gap-2 border-t border-pfx-border pt-3">
            {!confirmingRegen ? (
              <button
                type="button"
                onClick={() => setConfirmingRegen(true)}
                disabled={regenerating || actionsDisabled}
                className="flex items-center gap-1.5 rounded-[var(--pfx-radius)] border border-pfx-border px-2.5 py-1.5 text-xs font-medium text-pfx-text-muted transition-colors hover:text-pfx-text disabled:opacity-40"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${regenerating ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
                {regenerating ? "Regenerando…" : "Regenerar"}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-pfx-warning">Reemplaza esta dirección</span>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmingRegen(false);
                    onRegenerate?.();
                  }}
                  className="rounded-[var(--pfx-radius)] bg-pfx-warning px-2.5 py-1 text-[11px] font-medium text-pfx-canvas transition-colors hover:opacity-90"
                >
                  Confirmar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingRegen(false)}
                  className="text-[11px] text-pfx-text-muted hover:text-pfx-text"
                >
                  Cancelar
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onChoose}
              disabled={actionsDisabled}
              className="ml-auto flex items-center gap-1.5 rounded-[var(--pfx-radius)] bg-pfx-accent px-3 py-1.5 text-xs font-medium text-pfx-on-accent transition-colors hover:bg-pfx-accent-strong disabled:opacity-40"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Elegir esta dirección
            </button>
          </div>
        )}
      </div>
    </ForgeZone>
  );
}
