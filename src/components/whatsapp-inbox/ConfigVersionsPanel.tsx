"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { BotConfigVersion, SimulateResult } from "@/types/whatsapp-inbox";

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-xl border border-border p-3">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function extractErrorMessage(data: { error?: string; detail?: string }, status: number): string {
  return data.error ?? data.detail ?? `HTTP ${status}`;
}

const STATUS_CLASSES: Record<BotConfigVersion["status"], string> = {
  draft: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  archived: "border-border bg-muted text-muted-foreground",
};

/**
 * Versionado de config (draft → publish → rollback) + playground de
 * simulación (/internal/simulate). Deliberadamente separado de BotConfigView:
 * el "Guardar cambios" inmediato que ya usa producción no se toca — esto
 * opera sobre la última config guardada, para experimentar sin arriesgar
 * ese flujo. Ver plan Fase 4.
 */
export function ConfigVersionsPanel() {
  const [versions, setVersions] = useState<BotConfigVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [publishingVersion, setPublishingVersion] = useState<number | null>(null);
  const [restoringVersion, setRestoringVersion] = useState<number | null>(null);

  const [message, setMessage] = useState("");
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
    } finally {
      setSimulating(false);
    }
  }

  return (
    <div className="scrollbar-soft min-h-0 flex-1 space-y-4 overflow-y-auto p-4 pb-6">
      <SectionCard title="Probar personalidad">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Mensaje de prueba…"
          className="min-h-[60px] border-border bg-secondary/40 text-sm text-foreground"
        />
        <Button
          type="button"
          onClick={() => void handleSimulate()}
          disabled={simulating}
          className="h-8 bg-cyan-600 text-xs text-white hover:bg-cyan-500"
        >
          {simulating && <Spinner size="sm" />}
          Simular
        </Button>
        <p className="text-[11px] text-muted-foreground/60">
          Corre el pipeline completo (prompt, ejemplos, memoria, escalamiento) sin enviar nada a WhatsApp ni persistir.
        </p>

        {simulateResult && (
          <div className="space-y-2 rounded-lg border border-border bg-secondary/20 p-3">
            {simulateResult.respuesta && (
              <p className="text-sm text-foreground">{simulateResult.respuesta}</p>
            )}
            <div className="flex flex-wrap items-center gap-1.5">
              {simulateResult.intent_detectado && (
                <Badge variant="outline" className="border-border bg-muted text-[11px] font-normal text-muted-foreground">
                  intención: {simulateResult.intent_detectado}
                </Badge>
              )}
              {simulateResult.confianza != null && (
                <Badge variant="outline" className="border-border bg-muted text-[11px] font-normal text-muted-foreground">
                  confianza: {simulateResult.confianza.toFixed(2)}
                </Badge>
              )}
              {simulateResult.escalaria && (
                <Badge
                  variant="outline"
                  className="border-amber-500/30 bg-amber-500/10 text-[11px] font-normal text-amber-700 dark:text-amber-300"
                >
                  escalaría{simulateResult.razon_escalamiento ? ` — ${simulateResult.razon_escalamiento}` : ""}
                </Badge>
              )}
            </div>
            {simulateResult.reglas_aplicadas.length > 0 && (
              <ul className="list-inside list-disc space-y-0.5 text-[11px] text-muted-foreground">
                {simulateResult.reglas_aplicadas.map((regla, idx) => (
                  <li key={idx}>{regla}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Versiones de la configuración">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void handleSaveDraft()}
          disabled={savingDraft}
          className="h-8 border-border bg-secondary/40 text-xs text-muted-foreground hover:bg-secondary/60"
        >
          {savingDraft && <Spinner size="sm" />}
          Guardar config actual como borrador
        </Button>

        {loading && (
          <div className="flex items-center justify-center py-4">
            <Spinner size="sm" className="text-muted-foreground" />
          </div>
        )}
        {error && <p className="text-xs text-muted-foreground">{error}</p>}
        {!loading && !error && versions.length === 0 && (
          <p className="text-xs text-muted-foreground/60">Sin versiones guardadas todavía.</p>
        )}
        <div className="space-y-1.5">
          {versions.map((v) => (
            <div key={v.version} className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-foreground">v{v.version}</span>
                <Badge variant="outline" className={`font-normal ${STATUS_CLASSES[v.status]}`}>
                  {v.status}
                </Badge>
                <span className="text-[11px] text-muted-foreground">{v.created_by}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {v.status !== "active" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void handlePublish(v.version)}
                    disabled={publishingVersion !== null}
                    className="h-7 border-border bg-secondary/40 text-[11px] text-muted-foreground hover:bg-secondary/60"
                  >
                    Publicar
                  </Button>
                )}
                {v.status === "archived" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleRollback(v.version)}
                    disabled={restoringVersion !== null}
                    className="h-7 text-[11px] text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  >
                    Restaurar
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
