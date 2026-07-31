"use client";

import { useState } from "react";
import { Bot, FlaskConical, GraduationCap, Inbox, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { BotConfigView } from "./BotConfigView";
import { ConfigVersionsPanel } from "./ConfigVersionsPanel";
import { ExamplesView } from "./ExamplesView";
import { InboxShell } from "./InboxShell";

type ModuleTab = "inbox" | "config" | "examples" | "versions";

/**
 * Navegación por objetivo, no por artefacto técnico (§5 del plan):
 * Bandeja = atender · Bot = configurar comportamiento · Entrenamiento =
 * enseñar respuestas · Pruebas = simular y publicar. Los ids internos se
 * conservan (inbox/config/examples/versions) para no tocar ningún consumo.
 */
const MODULE_TABS: { id: ModuleTab; label: string; icon: LucideIcon }[] = [
  { id: "inbox", label: "Bandeja", icon: Inbox },
  { id: "config", label: "Bot", icon: Bot },
  { id: "examples", label: "Entrenamiento", icon: GraduationCap },
  { id: "versions", label: "Pruebas", icon: FlaskConical },
];

interface WhatsAppModuleProps {
  tenantId: string;
}

/**
 * Shell de PixelBot Console: header compacto de producto + tabs custom
 * (patrón ClientWorkspace, no shadcn Tabs) y el panel activo debajo.
 * No muestra estado de canal: no existe health real del lado de Meta (P1).
 */
export function WhatsAppModule({ tenantId }: WhatsAppModuleProps) {
  const [activeTab, setActiveTab] = useState<ModuleTab>("inbox");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-shrink-0 border-b border-border bg-card px-4 pt-3">
        <div className="flex items-baseline gap-2">
          <h1 className="text-sm font-semibold text-foreground">PixelBot</h1>
          <p className="hidden text-xs text-muted-foreground sm:block">
            Consola de WhatsApp — atención, bot y entrenamiento
          </p>
        </div>
        <nav aria-label="Secciones de PixelBot" className="mt-2 flex items-center gap-0.5 overflow-x-auto scrollbar-none">
          {MODULE_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-current={activeTab === id ? "page" : undefined}
              onClick={() => setActiveTab(id)}
              className={cn(
                "relative flex flex-shrink-0 items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40",
                activeTab === id ? "text-cyan-300" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon aria-hidden className="h-4 w-4 opacity-80" />
              {label}
              {activeTab === id && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full bg-cyan-400"
                />
              )}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {activeTab === "inbox" && <InboxShell tenantId={tenantId} onOpenConfig={() => setActiveTab("config")} />}
        {activeTab === "config" && <BotConfigView />}
        {activeTab === "examples" && <ExamplesView />}
        {activeTab === "versions" && <ConfigVersionsPanel />}
      </div>
    </div>
  );
}
