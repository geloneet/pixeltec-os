"use client";

import { useEffect, useState } from "react";
import { FlaskConical, History, Send } from "lucide-react";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { BotConfigVersion, SimulateResult } from "@/types/whatsapp-inbox";
import { EmptyState } from "./ui/EmptyState";
import { WhatsAppSection } from "./ui/WhatsAppSection";
import { extractErrorMessage, VERSION_STATUS_META } from "./ui/meta";

function formatVersionDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("es-MX", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

type TestsTab = "simulador" | "versiones";

type ConfirmAction = { type: "publish" | "rollback"; version: number } | null;

/**
 * Pruebas (§8.10, antes "Versiones y playground"): subtabs Simulador |
 * Versiones. El simulador corre el pipeline completo sin enviar ni persistir;
 * Versiones opera el draft → publish → rollback con confirmación explícita
 * que explica el impacto. Deliberadamente separado de BotConfigView: el
 * "Guardar cambios" inmediato que ya usa producción no se toca. Sin diff
 * entre versiones: el API no lo provee (P1) y no se inventa.
 */
export function ConfigVersionsPanel() {
  const [activeTab, setActiveTab] = useState<TestsTab>("simulador");
  const [versions, setVersions] = useState<BotConfigVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [publishingVersion, setPublishingVersion] = useState<number | null>(null);
  const [restoringVersion, setRestoringVersion] = useState<number | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

  const [message, setMessage] = useState("");
  const [lastAsked, setLastAsked] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [simulateResult, setSimulateResult] = useState<SimulateResult | null>(null);

  async function loadVersions() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/whatsapp-inbox/config/versions", { cache: "no-store" });
      const data = (await res.json()) as { versions?: BotConfigVersion[]; error?: string; detail?: string };
      if (!res.ok || !data.versions) {
        throw new Error(extractErrorMessage(data, res.status));
      }
      setVersions(data.versions);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadVersions();
  }, []);

  async function handleSaveDraft() {
    if (savingDraft) return;
    setSavingDraft(true);
    try {
      const currentRes = await fetch("/api/whatsapp-inbox/config", { cache: "no-store" });
      const currentData = (await currentRes.json()) as { config?: Record<string, unknown>; error?: string };
      if (!currentRes.ok || !currentData.config) {
        throw new Error(extractErrorMessage(currentData, currentRes.status));
      }

      const res = await fetch("/api/whatsapp-inbox/config/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: currentData.config }),
      });
      const data = (await res.json()) as { version?: number; error?: string; detail?: string };
      if (!res.ok || typeof data.version !== "number") {
        throw new Error(extractErrorMessage(data, res.status));
      }
      toast.success(`Borrador v${data.version} guardado`);
      await loadVersions();
    } catch (err) {
      toast.error(`No se pudo guardar el borrador: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSavingDraft(false);
    }
  }

  async function handlePublish(version: number) {
    if (publishingVersion) return;
    setPublishingVersion(version);
    try {
      const res = await fetch("/api/whatsapp-inbox/config/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version }),
      });
      const data = (await res.json()) as { config?: unknown; error?: string; detail?: string };
      if (!res.ok || !data.config) {
        throw new Error(extractErrorMessage(data, res.status));
      }
      toast.success(`v${version} publicada — el bot ya usa esta config`);
      await loadVersions();
    } catch (err) {
      toast.error(`No se pudo publicar: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPublishingVersion(null);
    }
  }

  async function handleRollback(version: number) {
    if (restoringVersion) return;
    setRestoringVersion(version);
    try {
      const res = await fetch("/api/whatsapp-inbox/config/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version }),
      });
      const data = (await res.json()) as { config?: unknown; error?: string; detail?: string };
      if (!res.ok || !data.config) {
        throw new Error(extractErrorMessage(data, res.status));
      }
      toast.success(`Se restauró v${version}`);
      await loadVersions();
    } catch (err) {
      toast.error(`No se pudo restaurar: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRestoringVersion(null);
    }
  }

  async function handleSimulate() {
    const trimmed = message.trim();
    if (!trimmed) {
      toast.error("Escribe un mensaje de prueba");
      return;
    }
    setSimulating(true);
    setSimulateResult(null);
    setLastAsked(trimmed);
    try {
      const res = await fetch("/api/whatsapp-inbox/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      const data = (await res.json()) as SimulateResult & { error?: string; detail?: string };
      if (!res.ok) {
        throw new Error(extractErrorMessage(data, res.status));
      }
      setSimulateResult(data);
    } catch (err) {
      toast.error(`No se pudo simular: ${err instanceof Error ? err.message : String(err)}`);
      setLastAsked(null);
    } finally {
      setSimulating(false);
    }
  }

  const pendingConfirm = confirmAction;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      {/* Subtabs Simulador | Versiones (§8.10) */}
      <div className="flex flex-shrink-0 border-b border-border px-4" role="tablist" aria-label="Secciones de pruebas">
        {(
          [
            ["simulador", "Simulador", FlaskConical],
            ["versiones", "Versiones", History],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "relative flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40",
              activeTab === id ? "text-cyan-300" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon aria-hidden className="h-3.5 w-3.5 opacity-80" />
            {label}
            {activeTab === id && (
              <span aria-hidden className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full bg-cyan-400" />
            )}
          </button>
        ))}
      </div>

      <div className="scrollbar-soft min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl space-y-4 p-4 pb-6">
          {activeTab === "simulador" && (
            <>
              <WhatsAppSection
                title="Simulador"
                description="Prueba cómo respondería el bot — no envía nada a WhatsApp ni guarda cambios"
              >
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleSimulate();
                    }
                  }}
                  placeholder="Escribe como si fueras un cliente…"
                  aria-label="Mensaje de prueba"
                  className="min-h-[60px] border-border bg-secondary/40 text-sm text-foreground"
                />
                <Button
                  type="button"
                  onClick={() => void handleSimulate()}
                  disabled={simulating || !message.trim()}
                  className="h-8 bg-cyan-600 text-xs text-white hover:bg-cyan-500"
                >
                  {simulating ? <Spinner size="sm" /> : <Send aria-hidden className="h-3.5 w-3.5" />}
                  Probar mensaje
                </Button>
              </WhatsAppSection>

              {simulating && (
                <div className="flex items-center gap-2 p-2 text-sm text-muted-foreground">
                  <Spinner size="sm" />
                  El bot está pensando su respuesta…
                </div>
              )}

              {simulateResult && (
                <div className="space-y-3">
                  {/* Conversación simulada, como se vería en el hilo */}
                  <div className="space-y-2">
                    {lastAsked && (
                      <div className="flex justify-start">
                        <div className="max-w-[80%] rounded-2xl rounded-bl-sm bg-secondary px-3.5 py-2 text-sm text-foreground">
                          {lastAsked}
                        </div>
                      </div>
                    )}
                    <div className="flex justify-end">
                      <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-cyan-600 px-3.5 py-2 text-sm text-white">
                        {simulateResult.respuesta ?? "(el bot no respondería — revisa horario y reglas)"}
                      </div>
                    </div>
                  </div>

                  <WhatsAppSection title="Por qué respondió así">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {simulateResult.intent_detectado && (
                        <Badge variant="outline" className="border-border bg-muted text-xs font-normal text-muted-foreground">
                          Intención: {simulateResult.intent_detectado}
                        </Badge>
                      )}
                      {simulateResult.confianza != null && (
                        <Badge variant="outline" className="border-border bg-muted text-xs font-normal text-muted-foreground">
                          Confianza: {Math.round(simulateResult.confianza * 100)}%
                        </Badge>
                      )}
                      {simulateResult.fuera_de_horario && (
                        <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-xs font-normal text-amber-700 dark:text-amber-300">
                          Fuera de horario
                        </Badge>
                      )}
                      {simulateResult.escalaria && (
                        <Badge
                          variant="outline"
                          className="border-amber-500/30 bg-amber-500/10 text-xs font-normal text-amber-700 dark:text-amber-300"
                        >
                          Transferiría a una persona
                          {simulateResult.razon_escalamiento ? ` — ${simulateResult.razon_escalamiento}` : ""}
                        </Badge>
                      )}
                      {simulateResult.version_simulada != null && (
                        <Badge variant="outline" className="border-border bg-muted text-xs font-normal text-muted-foreground">
                          Config v{simulateResult.version_simulada}
                        </Badge>
                      )}
                    </div>
                    {simulateResult.reglas_aplicadas.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Reglas aplicadas</p>
                        <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs text-muted-foreground">
                          {simulateResult.reglas_aplicadas.map((regla, idx) => (
                            <li key={idx}>{regla}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </WhatsAppSection>
                </div>
              )}
            </>
          )}

          {activeTab === "versiones" && (
            <WhatsAppSection
              title="Versiones de la configuración"
              description="Guarda snapshots de la config y publica o restaura con un clic"
              actions={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handleSaveDraft()}
                  disabled={savingDraft}
                  className="h-8 border-border bg-secondary/40 text-xs text-muted-foreground hover:bg-secondary/60"
                >
                  {savingDraft && <Spinner size="sm" />}
                  Guardar como borrador
                </Button>
              }
            >
              {loading && (
                <div className="flex items-center justify-center py-4">
                  <Spinner size="sm" className="text-muted-foreground" />
                </div>
              )}
              {error && (
                <EmptyState
                  icon={History}
                  tone="error"
                  title="No se pudieron cargar las versiones"
                  description={error}
                  actions={
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void loadVersions()}
                      className="border-border bg-secondary/40 text-xs text-muted-foreground hover:bg-secondary/60"
                    >
                      Reintentar
                    </Button>
                  }
                />
              )}
              {!loading && !error && versions.length === 0 && (
                <EmptyState
                  icon={History}
                  title="Sin versiones guardadas"
                  description="Cada versión es una foto de la configuración del bot. Guarda la actual como borrador para poder volver a ella cuando quieras."
                />
              )}
              <div className="space-y-1.5">
                {versions.map((v) => {
                  const statusMeta = VERSION_STATUS_META[v.status];
                  return (
                    <div
                      key={v.version}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-2.5 py-2"
                    >
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-foreground">v{v.version}</span>
                        <Badge variant="outline" className={cn("font-normal", statusMeta.className)}>
                          {statusMeta.label}
                        </Badge>
                        <span className="truncate text-xs text-muted-foreground">{v.created_by}</span>
                        {(v.published_at ?? v.created_at) && (
                          <span className="text-xs text-muted-foreground/60">
                            {formatVersionDate(v.published_at ?? v.created_at)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {v.status !== "active" && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setConfirmAction({ type: "publish", version: v.version })}
                            disabled={publishingVersion !== null || restoringVersion !== null}
                            className="h-7 border-border bg-secondary/40 text-xs text-muted-foreground hover:bg-secondary/60"
                          >
                            {publishingVersion === v.version && <Spinner size="sm" />}
                            Publicar
                          </Button>
                        )}
                        {v.status === "archived" && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmAction({ type: "rollback", version: v.version })}
                            disabled={publishingVersion !== null || restoringVersion !== null}
                            className="h-7 text-xs text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                          >
                            {restoringVersion === v.version && <Spinner size="sm" />}
                            Restaurar
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </WhatsAppSection>
          )}
        </div>
      </div>

      {/* Confirmación con impacto explícito (§8.10) */}
      <AlertDialog open={pendingConfirm !== null} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent className="border-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">
              {pendingConfirm?.type === "publish"
                ? `¿Publicar la versión v${pendingConfirm?.version}?`
                : `¿Restaurar la versión v${pendingConfirm?.version}?`}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {pendingConfirm?.type === "publish"
                ? "El bot empezará a responder con esta configuración de inmediato en todas las conversaciones. La versión activa actual pasará a archivada."
                : "La configuración del bot volverá a esta versión de inmediato en todas las conversaciones. La versión activa actual pasará a archivada."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border bg-secondary/40 text-xs text-muted-foreground hover:bg-secondary/60">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!pendingConfirm) return;
                if (pendingConfirm.type === "publish") void handlePublish(pendingConfirm.version);
                else void handleRollback(pendingConfirm.version);
                setConfirmAction(null);
              }}
              className="bg-cyan-600 text-xs text-white hover:bg-cyan-500"
            >
              {pendingConfirm?.type === "publish" ? "Sí, publicar" : "Sí, restaurar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
