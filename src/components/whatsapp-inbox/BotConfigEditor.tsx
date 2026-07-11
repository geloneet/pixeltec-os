"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { BotConfigV2, ConfigVersionMeta } from "@/types/pixelbot-config";
import { GeneralSection } from "./bot-config-tabs/GeneralSection";
import { PersonalitySection } from "./bot-config-tabs/PersonalitySection";
import { ResponsePolicySection } from "./bot-config-tabs/ResponsePolicySection";
import { EscalationSection } from "./bot-config-tabs/EscalationSection";
import { ExamplesTab } from "./bot-config-tabs/ExamplesTab";
import { MemoryTab } from "./bot-config-tabs/MemoryTab";
import { PlaygroundTab } from "./bot-config-tabs/PlaygroundTab";
import { VersionsTab } from "./bot-config-tabs/VersionsTab";
import { extractErrorMessage, formatUpdatedAt } from "./bot-config-tabs/_shared";

type TabId = "general" | "personality" | "policy" | "escalation" | "examples" | "memory" | "playground" | "versions";

const TABS: { id: TabId; label: string }[] = [
  { id: "general", label: "General" },
  { id: "personality", label: "Personalidad" },
  { id: "policy", label: "Política de respuesta" },
  { id: "escalation", label: "Escalamiento" },
  { id: "examples", label: "Ejemplos" },
  { id: "memory", label: "Memoria" },
  { id: "playground", label: "Playground" },
  { id: "versions", label: "Versiones" },
];

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

/**
 * Shell de la UI de configuración de PixelBot Fase A. Flujo borrador →
 * publicar (ADR-001 + excepción al freeze v1.0 del 2026-07-11, ver NeuroPIXEL):
 *
 * "Guardar borrador" SIEMPRE crea una versión nueva a partir del estado
 * actual del formulario (create_draft). No existe forma de recargar el
 * CONTENIDO de un borrador ya guardado (el backend solo expone metadata en
 * /internal/config/versions, no el config_json) — por eso "Publicar" activa
 * exactamente la última versión que TÚ guardaste en esta sesión, nunca una
 * mezcla con ediciones locales no guardadas. Si recargas la página con
 * cambios sin guardar, se pierden (igual que el formulario legacy); un
 * borrador ya guardado en el servidor sigue disponible para publicar o
 * previsualizar en el Playground, aunque el formulario no lo vuelva a cargar.
 */
export function BotConfigEditor() {
  const [activeConfig, setActiveConfig] = useState<BotConfigV2 | null>(null);
  const [draftConfig, setDraftConfig] = useState<BotConfigV2 | null>(null);
  const [pendingDraft, setPendingDraft] = useState<ConfigVersionMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("general");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [configRes, versionsRes] = await Promise.all([
        fetch("/api/whatsapp-inbox/config", { cache: "no-store" }),
        fetch("/api/whatsapp-inbox/config/versions", { cache: "no-store" }),
      ]);
      const configData = (await configRes.json()) as { config?: BotConfigV2; error?: string };
      if (!configRes.ok || !configData.config) {
        throw new Error(extractErrorMessage(configData, configRes.status));
      }
      setActiveConfig(configData.config);
      setDraftConfig(clone(configData.config));

      const versionsData = (await versionsRes.json()) as { versions?: ConfigVersionMeta[] };
      const drafts = (versionsData.versions ?? []).filter((v) => v.status === "draft");
      const latestDraft = drafts.length > 0 ? drafts.reduce((a, b) => (a.version > b.version ? a : b)) : null;
      setPendingDraft(latestDraft);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const dirty = useMemo(() => {
    if (!draftConfig || !activeConfig) return false;
    return JSON.stringify(draftConfig) !== JSON.stringify(activeConfig);
  }, [draftConfig, activeConfig]);

  function handleChange(patch: Partial<BotConfigV2>) {
    setDraftConfig((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  function handleDiscard() {
    if (activeConfig) setDraftConfig(clone(activeConfig));
  }

  async function handleSaveDraft() {
    if (!draftConfig || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/whatsapp-inbox/config/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: draftConfig }),
      });
      const data = (await res.json()) as { version?: number; error?: string };
      if (!res.ok || data.version === undefined) throw new Error(extractErrorMessage(data, res.status));
      toast.success(`Borrador guardado (v${data.version})`);
      await load();
    } catch (err) {
      toast.error(`No se pudo guardar el borrador: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!pendingDraft || publishing) return;
    setPublishing(true);
    try {
      const res = await fetch("/api/whatsapp-inbox/config/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: pendingDraft.version }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractErrorMessage(data, res.status));
      toast.success(`Versión ${pendingDraft.version} publicada y activa`);
      await load();
    } catch (err) {
      toast.error(`No se pudo publicar: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPublishing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center">
        <Spinner size="md" className="text-zinc-500" />
      </div>
    );
  }

  if (error || !draftConfig || !activeConfig) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-sm text-zinc-400">No se pudo cargar la configuración del bot.</p>
        {error && <p className="max-w-md text-xs text-zinc-600">{error}</p>}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void load()}
          className="border-zinc-800 bg-zinc-900/60 text-xs text-zinc-300 hover:bg-zinc-800/60"
        >
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      {/* Sub-tabs */}
      <div className="flex-shrink-0 border-b border-white/[0.06] px-4 pt-2">
        <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-none">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative flex-shrink-0 px-3 py-2.5 text-xs font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40",
                activeTab === tab.id ? "text-cyan-300" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span aria-hidden="true" className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full bg-cyan-400" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Banner de borrador pendiente */}
      {pendingDraft && (
        <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-amber-500/20 bg-amber-500/5 px-4 py-2 text-xs">
          <span className="text-amber-300">
            Tienes un borrador sin publicar (v{pendingDraft.version}, guardado {formatUpdatedAt(pendingDraft.created_at)})
          </span>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                disabled={publishing}
                className="flex-shrink-0 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-300 hover:bg-amber-500/20 disabled:opacity-40"
              >
                Publicar v{pendingDraft.version}
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="border-zinc-800 bg-zinc-950">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-zinc-100">¿Publicar la versión {pendingDraft.version}?</AlertDialogTitle>
                <AlertDialogDescription className="text-zinc-400">
                  El bot empezará a responder con esta configuración desde el siguiente mensaje.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800">
                  Cancelar
                </AlertDialogCancel>
                <AlertDialogAction onClick={() => void handlePublish()} className="bg-cyan-600 text-white hover:bg-cyan-500">
                  Publicar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {/* Contenido de la tab activa */}
      <div className="scrollbar-soft min-h-0 flex-1 overflow-y-auto p-4 pb-6">
        {activeTab === "general" && <GeneralSection config={draftConfig} onChange={handleChange} />}
        {activeTab === "personality" && <PersonalitySection config={draftConfig} onChange={handleChange} />}
        {activeTab === "policy" && <ResponsePolicySection config={draftConfig} onChange={handleChange} />}
        {activeTab === "escalation" && <EscalationSection config={draftConfig} onChange={handleChange} />}
        {activeTab === "examples" && <ExamplesTab />}
        {activeTab === "memory" && <MemoryTab />}
        {activeTab === "playground" && <PlaygroundTab />}
        {activeTab === "versions" && <VersionsTab onRolledBack={() => void load()} />}

        {activeConfig.updated_at && ["general", "personality", "policy", "escalation"].includes(activeTab) && (
          <div className="mt-4 space-y-1 rounded-xl border border-zinc-800/60 p-3 text-[11px] text-zinc-500">
            <p>Estos campos se guardan como borrador y solo aplican al publicar.</p>
            <p>
              Versión activa: v{activeConfig.version ?? "—"} · última publicación{" "}
              {formatUpdatedAt(activeConfig.updated_at)}
              {activeConfig.updated_by ? ` · ${activeConfig.updated_by}` : ""}
            </p>
          </div>
        )}
      </div>

      {/* Barra sticky — solo para las tabs de config editable */}
      {["general", "personality", "policy", "escalation"].includes(activeTab) && (
        <div className="flex flex-shrink-0 items-center justify-end gap-2 border-t border-zinc-800/60 bg-zinc-950/80 px-4 py-3 backdrop-blur-xl">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDiscard}
            disabled={!dirty || saving}
            className="h-8 text-xs text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100"
          >
            Descartar cambios
          </Button>
          <Button
            type="button"
            onClick={() => void handleSaveDraft()}
            disabled={!dirty || saving}
            className="h-8 bg-cyan-600 text-xs text-white hover:bg-cyan-500"
          >
            {saving && <Spinner size="sm" />}
            Guardar borrador
          </Button>
        </div>
      )}
    </div>
  );
}
