"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  AlertTriangle,
  Loader2,
  Lock,
  RefreshCw,
  RotateCcw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import {
  chooseDirectionAction,
  setRunDecisionAction,
} from "@/app/(admin)/proyectos/pixelforge/actions";
import { usePixelforgeRun } from "@/hooks/pixelforge/use-pixelforge-run";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ForgeZone, type ForgeState } from "@/components/pixelforge/forge/ForgeZone";
import { ForgeStamp } from "@/components/pixelforge/forge/ForgeStamp";
import { DirectionCard, type DirectionCardView } from "./DirectionCard";
import type { PixelforgeArtifactStatus } from "@/lib/pixelforge/types";
import type { DirectionDecision } from "@/lib/pixelforge/schemas/direction-decision";

interface Props {
  projectId: string;
  /** Status del artifact `direction_decision`. */
  artifactStatus: PixelforgeArtifactStatus;
  /** true si el Visual DNA está sellado — habilita generar direcciones. */
  visualSealed: boolean;
  /** Direcciones creativas del proyecto (orden de slot, tal como vienen del repo). */
  directions: DirectionCardView[];
  /** id→nombre de capabilities certificadas — resuelto por la page. */
  capabilityNames: Record<string, string>;
  /** Draft actual (sealedContent si sellado, currentDraft si no) del artifact `direction_decision`. */
  draft: DirectionDecision | null;
  /**
   * ISO del sellado (PF-X2 T3, calco de `VisualDnaPanel`/`LandingDnaPanel`) —
   * habilita la `ForgeStamp` en la plancha de la leyenda cuando
   * `artifactStatus === "sealed"`. Puramente presentacional: sin este prop el
   * panel simplemente no muestra la estampa (no rompe consumidores existentes).
   */
  sealedAt?: string | null;
}

const MIN_RATIONALE_LENGTH = 10;

/**
 * Materialidad de las planchas según el status del artifact
 * (docs/pixelforge/product-dna.md § Estados canónicos). `forging` se reserva
 * a la plancha dedicada de progreso (`isGenerating`, más abajo) para no
 * duplicar la señal de "trabajándose" en cada card simultáneamente — durante
 * una regeneración de slot, las OTRAS cards no cambian de materialidad, solo
 * el botón "Regenerar" del slot activo (prop `regenerating` de `DirectionCard`).
 */
function zoneStateForArtifact(status: PixelforgeArtifactStatus): ForgeState {
  if (status === "sealed") return "sealed";
  if (status === "invalidated") return "invalidated";
  return "draft";
}

/**
 * `generate_directions` NUNCA persiste `lastRunId` en el artifact (a
 * diferencia de `synthesize_visual_dna`/`generate_strategy`): su
 * `persistResult` escribe directo a `pixelforge_creative_directions`
 * (`replaceCreativeDirections`/`replaceCreativeDirection`), no pasa por
 * `updateArtifactDraft`. Por eso el feedback útil/no útil de ESTE panel se
 * ata al `runId` de la corrida recién completada EN ESTA SESIÓN (estado
 * local), no a un prop persistido desde la page como en `VisualDnaPanel`.
 *
 * Reskin PF-X2 T3 (estación Direcciones, el caso más denso de X2): cards con
 * paleta/scores/razones, elección + sellado. La dirección elegida usa
 * materialidad destacada (veta cobre, ver `DirectionCard`); la sellada
 * muestra stamp + notch. IMPORTANTE: el `<Dialog>` de elección (Radix Portal)
 * renderiza en `document.body`, FUERA del wrapper `[data-product="pixelforge"]`
 * que activa los tokens `--pfx-*` (`pixelforge/layout.tsx`) — cualquier
 * `bg-pfx-*`/`text-pfx-*` dentro del diálogo resolvería a un valor de CSS var
 * indefinido (panel invisible/transparente). Por eso el contenido del diálogo
 * se mantiene con el tema global del admin (`bg-background`, `text-foreground`,
 * `bg-primary`, etc. — ya portal-safe, sin branding cyan) en vez de los tokens
 * de forja; todo lo que vive FUERA del diálogo (cards, tabla, banners) sí usa
 * `--pfx-*` con normalidad, porque nunca sale del árbol escopado.
 */
export function DirectionsPanel({
  projectId,
  artifactStatus,
  visualSealed,
  directions,
  capabilityNames,
  draft,
  sealedAt,
}: Props) {
  const router = useRouter();
  const [runId, setRunId] = useState<string | null>(null);
  // Slot de la regeneración en curso — null cuando es una generación completa (o no hay corrida activa).
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const [decisionGiven, setDecisionGiven] = useState(false);
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [choosing, setChoosing] = useState<DirectionCardView | null>(null);
  const [rationale, setRationale] = useState("");
  const [acceptedRisks, setAcceptedRisks] = useState<Set<string>>(new Set());
  const [extraRisk, setExtraRisk] = useState("");
  const [combinedIds, setCombinedIds] = useState<Set<string>>(new Set());
  const [choosingBusy, setChoosingBusy] = useState(false);

  const { run } = usePixelforgeRun(runId);
  const handledRunRef = useRef<string | null>(null);

  useEffect(() => {
    if (!run || !runId || handledRunRef.current === runId) return;
    if (run.status === "succeeded") {
      handledRunRef.current = runId;
      toast.success(activeSlot ? `Dirección del slot ${activeSlot} regenerada` : "3 direcciones generadas");
      setDecisionGiven(false);
      router.refresh();
    } else if (run.status === "failed") {
      handledRunRef.current = runId;
      const msg = run.error ?? "No se pudo generar direcciones";
      setFailureMessage(msg);
      toast.error(msg);
    }
  }, [run, runId, router, activeSlot]);

  const editable = artifactStatus !== "sealed";
  const isGenerating = starting || (!!runId && handledRunRef.current !== runId);
  const zoneState = zoneStateForArtifact(artifactStatus);

  // Elección obsoleta (decisión F5 #6): el draft apunta a una dirección que ya
  // no está vigente como "chosen" — una generación completa la reemplazó por
  // ids nuevos, o la regeneración de justo ese slot la revirtió a "candidate".
  const obsolete =
    !!draft && !directions.some((d) => d.id === draft.chosenDirectionId && d.status === "chosen");

  const sorted = [...directions].sort((a, b) => b.scoreTotal - a.scoreTotal);

  const startGeneration = async (slot?: number) => {
    setStarting(true);
    setFailureMessage(null);
    handledRunRef.current = null;
    setActiveSlot(slot ?? null);
    try {
      const res = await fetch("/api/pixelforge/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          slot ? { projectId, operation: "generate_directions", slot } : { projectId, operation: "generate_directions" }
        ),
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = json.error ?? "No se pudo iniciar la generación";
        setFailureMessage(msg);
        toast.error(msg);
        return;
      }
      // Contrato async (fire-and-forget) — el resultado llega por el poller (`usePixelforgeRun`).
      setRunId(json.runId ?? null);
    } catch {
      const msg = "No se pudo iniciar la generación";
      setFailureMessage(msg);
      toast.error(msg);
    } finally {
      setStarting(false);
    }
  };

  const submitDecision = async (decision: "accepted" | "rejected") => {
    if (!runId || decisionBusy) return;
    setDecisionBusy(true);
    const r = await setRunDecisionAction({ runId, decision });
    setDecisionBusy(false);
    if (!r.success) {
      toast.error(r.error ?? "No se pudo registrar tu respuesta");
      return;
    }
    setDecisionGiven(true);
  };

  const openChoose = (direction: DirectionCardView) => {
    setChoosing(direction);
    setRationale("");
    setAcceptedRisks(new Set(direction.scores.risks));
    setExtraRisk("");
    setCombinedIds(new Set());
  };

  const closeChoose = () => setChoosing(null);

  const toggleRisk = (risk: string) => {
    setAcceptedRisks((prev) => {
      const next = new Set(prev);
      if (next.has(risk)) next.delete(risk);
      else next.add(risk);
      return next;
    });
  };

  const toggleCombined = (id: string) => {
    setCombinedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const rationaleValid = rationale.trim().length >= MIN_RATIONALE_LENGTH;

  const submitChoose = async () => {
    if (!choosing || choosingBusy || !rationaleValid) return;
    setChoosingBusy(true);
    const risks = [...acceptedRisks];
    const extra = extraRisk.trim();
    if (extra) risks.push(extra);
    const r = await chooseDirectionAction({
      projectId,
      directionId: choosing.id,
      rationale: rationale.trim(),
      acceptedRisks: risks,
      combinedFromDirectionIds: [...combinedIds],
    });
    setChoosingBusy(false);
    if (!r.success) {
      toast.error(r.error ?? "No se pudo registrar la elección");
      return;
    }
    toast.success("Dirección elegida");
    setChoosing(null);
    router.refresh();
  };

  const emptyStateHint = !visualSealed
    ? "Sella el ADN Visual antes de generar direcciones"
    : "La IA propone 3 direcciones creativas a partir del ADN Visual y la Estrategia sellados.";

  const signatureLabel = (direction: DirectionCardView) =>
    direction.signatureComponent.status === "capability"
      ? (capabilityNames[direction.signatureComponent.capabilityId] ?? direction.signatureComponent.capabilityId)
      : "Desarrollo custom";

  return (
    <div className="space-y-4">
      {artifactStatus === "invalidated" && (
        <ForgeZone state="invalidated" className="p-3">
          <div className="flex items-start gap-2 text-xs text-pfx-warning">
            <RotateCcw className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
            Esta decisión de dirección quedó invalidada por la reapertura de una estación anterior.
            Revísala y vuelve a sellar.
          </div>
        </ForgeZone>
      )}

      {obsolete && (
        <div className="flex items-start gap-2 rounded-[var(--pfx-radius)] border border-pfx-warning/30 bg-[hsl(var(--pfx-warning)/0.08)] px-3 py-2.5 text-xs text-pfx-warning">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          Elección obsoleta — la dirección elegida ya no está vigente. Vuelve a elegir.
        </div>
      )}

      {isGenerating && (
        <ForgeZone state="forging" variant="elevated" className="p-5">
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-pfx-accent" aria-hidden="true" />
            <div className="flex-1">
              <p className="text-sm text-pfx-text">
                {run?.currentStep ?? (activeSlot ? `Regenerando el slot ${activeSlot}…` : "Generando direcciones…")}
              </p>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[hsl(var(--pfx-border)/0.6)]">
                <div
                  className="h-full rounded-full bg-pfx-accent transition-all"
                  style={{ width: `${Math.max(5, run?.progress ?? 5)}%` }}
                />
              </div>
            </div>
          </div>
        </ForgeZone>
      )}

      {!isGenerating && failureMessage && (
        <div className="flex items-center justify-between gap-3 rounded-[var(--pfx-radius)] border border-pfx-warning/30 bg-[hsl(var(--pfx-warning)/0.08)] px-3 py-2.5">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-pfx-warning" aria-hidden="true" />
            <p className="text-xs text-pfx-warning">{failureMessage}</p>
          </div>
          <button
            type="button"
            onClick={() => startGeneration(activeSlot ?? undefined)}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-[var(--pfx-radius)] border border-pfx-warning/30 bg-[hsl(var(--pfx-warning)/0.1)] px-3 py-1.5 text-xs font-medium text-pfx-warning transition-colors hover:bg-[hsl(var(--pfx-warning)/0.2)]"
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            Reintentar
          </button>
        </div>
      )}

      {directions.length === 0 ? (
        !isGenerating &&
        (visualSealed ? (
          <ForgeZone variant="elevated" state="draft" className="px-6 py-16 text-center">
            <Sparkles className="mx-auto mb-3 h-6 w-6 text-pfx-accent" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-pfx-text">
                Todavía no hay direcciones creativas para este proyecto
              </p>
              <p className="mt-1 text-xs text-pfx-text-muted">{emptyStateHint}</p>
            </div>
            <button
              type="button"
              onClick={() => startGeneration()}
              className="mx-auto mt-4 flex items-center gap-2 rounded-[var(--pfx-radius)] bg-pfx-accent px-4 py-2 text-sm font-medium text-pfx-on-accent transition-colors hover:bg-pfx-accent-strong"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Generar 3 direcciones
            </button>
          </ForgeZone>
        ) : (
          // locked: la generación está gateada (ADN Visual sin sellar) — el
          // panel explica el gate sin romper la navegación de la estación
          // actual (docs/pixelforge/product-dna.md § Estados canónicos,
          // "locked"; precondición real verificada en el guard de
          // `generate_directions`, src/app/api/pixelforge/runs/route.ts).
          <ForgeZone variant="elevated" state="locked" className="px-6 py-16 text-center">
            <Lock className="mx-auto mb-3 h-6 w-6 text-pfx-forge-locked" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-pfx-text">
                Todavía no hay direcciones creativas para este proyecto
              </p>
              <p className="mt-1 text-xs text-pfx-text-muted">{emptyStateHint}</p>
            </div>
            <button
              type="button"
              onClick={() => startGeneration()}
              disabled
              title={emptyStateHint}
              className="mx-auto mt-4 flex items-center gap-2 rounded-[var(--pfx-radius)] bg-pfx-accent px-4 py-2 text-sm font-medium text-pfx-on-accent opacity-40"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Generar 3 direcciones
            </button>
          </ForgeZone>
        ))
      ) : (
        <div className="space-y-4">
          <ForgeZone state={zoneState} variant="elevated" className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-pfx-text-muted">
                El score ordena y alerta — la elección es tuya.
              </p>
              {artifactStatus === "sealed" && sealedAt && <ForgeStamp sealedAt={sealedAt} />}
            </div>
          </ForgeZone>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {sorted.map((direction) => (
              <DirectionCard
                key={direction.id}
                direction={direction}
                capabilityNames={capabilityNames}
                editable={editable}
                regenerating={isGenerating && activeSlot === direction.slot}
                actionsDisabled={isGenerating}
                onRegenerate={() => startGeneration(direction.slot)}
                onChoose={() => openChoose(direction)}
                zoneState={zoneState}
              />
            ))}
          </div>

          <ForgeZone state={zoneState} className="overflow-x-auto p-4">
            <table className="w-full min-w-[420px] text-left text-xs">
              <thead>
                <tr className="text-pfx-text-muted">
                  <th className="pb-2 pr-3 font-medium">Dirección</th>
                  {sorted.map((direction) => (
                    <th key={direction.id} className="pb-2 pr-3 font-medium text-pfx-text">
                      {direction.title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-pfx-text">
                <tr className="border-t border-pfx-border/60">
                  <td className="py-1.5 pr-3 text-pfx-text-muted">Motif</td>
                  {sorted.map((direction) => (
                    <td key={direction.id} className="py-1.5 pr-3">
                      {direction.signatureMotif.nombre}
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-pfx-border/60">
                  <td className="py-1.5 pr-3 text-pfx-text-muted">Signature</td>
                  {sorted.map((direction) => (
                    <td key={direction.id} className="py-1.5 pr-3">
                      {signatureLabel(direction)}
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-pfx-border/60">
                  <td className="py-1.5 pr-3 text-pfx-text-muted">Score total</td>
                  {sorted.map((direction) => (
                    <td key={direction.id} className="py-1.5 pr-3 font-forge-mono font-semibold text-pfx-text">
                      {direction.scoreTotal}
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-pfx-border/60">
                  <td className="py-1.5 pr-3 text-pfx-text-muted">Riesgo genericidad</td>
                  {sorted.map((direction) => (
                    <td key={direction.id} className="py-1.5 pr-3 font-forge-mono">
                      {direction.scores.riesgoGenericidadIA}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </ForgeZone>

          {runId && run?.status === "succeeded" && artifactStatus !== "sealed" && (
            <ForgeZone state="draft" className="p-3">
              <div className="flex items-center gap-3 px-1">
                {decisionGiven ? (
                  <p className="text-xs text-pfx-text-muted">Gracias por el feedback</p>
                ) : (
                  <>
                    <span className="text-xs text-pfx-text-muted">¿Te sirvió este resultado?</span>
                    <button
                      type="button"
                      onClick={() => submitDecision("accepted")}
                      disabled={decisionBusy}
                      className="flex items-center gap-1.5 rounded-[var(--pfx-radius)] border border-pfx-border px-2.5 py-1 text-xs text-pfx-text transition-colors hover:border-pfx-success/40 hover:text-pfx-success disabled:opacity-40"
                    >
                      <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
                      Útil
                    </button>
                    <button
                      type="button"
                      onClick={() => submitDecision("rejected")}
                      disabled={decisionBusy}
                      className="flex items-center gap-1.5 rounded-[var(--pfx-radius)] border border-pfx-border px-2.5 py-1 text-xs text-pfx-text transition-colors hover:border-pfx-error/40 hover:text-pfx-error disabled:opacity-40"
                    >
                      <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" />
                      No útil
                    </button>
                  </>
                )}
              </div>
            </ForgeZone>
          )}
        </div>
      )}

      {/*
        El Dialog (Radix Portal) renderiza en `document.body`, fuera del
        wrapper `[data-product="pixelforge"]` — se mantiene con el tema
        global del admin (portal-safe) en vez de tokens `--pfx-*` (ver
        docstring del componente), para no arrastrar branding de forja a un
        contenedor que no puede resolverlo.
      */}
      <Dialog open={!!choosing} onOpenChange={(open) => !open && closeChoose()}>
        <DialogContent>
          {choosing && (
            <>
              <DialogHeader>
                <DialogTitle>Elegir &ldquo;{choosing.title}&rdquo;</DialogTitle>
                <DialogDescription>
                  Registra por qué elegiste esta dirección — queda auditado junto con los riesgos que
                  aceptas conscientemente.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <div>
                  <label
                    htmlFor="direction-choice-rationale"
                    className="mb-1.5 block text-xs font-medium text-muted-foreground"
                  >
                    ¿Por qué esta dirección?
                  </label>
                  <textarea
                    id="direction-choice-rationale"
                    value={rationale}
                    onChange={(e) => setRationale(e.target.value)}
                    rows={3}
                    placeholder="Explica por qué elegiste esta dirección (mínimo 10 caracteres)…"
                    className="w-full resize-none rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm text-foreground placeholder-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>

                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Riesgos que aceptas</p>
                  {choosing.scores.risks.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">
                      Esta dirección no tiene riesgos identificados por la IA.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {choosing.scores.risks.map((risk) => (
                        <label key={risk} className="flex items-start gap-2 text-xs text-foreground">
                          <Checkbox
                            checked={acceptedRisks.has(risk)}
                            onCheckedChange={() => toggleRisk(risk)}
                            className="mt-0.5"
                          />
                          {risk}
                        </label>
                      ))}
                    </div>
                  )}
                  <input
                    type="text"
                    value={extraRisk}
                    onChange={(e) => setExtraRisk(e.target.value)}
                    placeholder="Otro riesgo que aceptas (opcional)…"
                    className="mt-2 w-full rounded-md border border-border bg-secondary/40 px-3 py-1.5 text-xs text-foreground placeholder-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>

                {directions.filter((d) => d.id !== choosing.id).length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                      ¿Tomé ideas de… (opcional)
                    </p>
                    <div className="space-y-1.5">
                      {directions
                        .filter((d) => d.id !== choosing.id)
                        .map((d) => (
                          <label key={d.id} className="flex items-center gap-2 text-xs text-foreground">
                            <Checkbox
                              checked={combinedIds.has(d.id)}
                              onCheckedChange={() => toggleCombined(d.id)}
                            />
                            {d.title}
                          </label>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <button
                  type="button"
                  onClick={closeChoose}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={submitChoose}
                  disabled={!rationaleValid || choosingBusy}
                  className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
                >
                  {choosingBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  Confirmar elección
                </button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
