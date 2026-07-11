"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { BotConfigEditor } from "./BotConfigEditor";
import { InboxShell } from "./InboxShell";

type ModuleTab = "inbox" | "config";

const MODULE_TABS: { id: ModuleTab; label: string }[] = [
  { id: "inbox", label: "Inbox" },
  { id: "config", label: "Configuración del bot" },
];

interface WhatsAppModuleProps {
  tenantId: string;
}

/**
 * Shell del módulo WhatsApp: título + tabs custom (patrón ClientWorkspace,
 * no shadcn Tabs) y el panel activo debajo.
 */
export function WhatsAppModule({ tenantId }: WhatsAppModuleProps) {
  const [activeTab, setActiveTab] = useState<ModuleTab>("inbox");

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header + tab bar */}
      <div className="flex-shrink-0 border-b border-white/[0.06] bg-zinc-950/40 px-4 pt-3">
        <h1 className="text-sm font-semibold text-zinc-100">WhatsApp</h1>
        <div className="mt-2 flex items-center gap-0.5 overflow-x-auto scrollbar-none">
          {MODULE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative flex-shrink-0 px-4 py-3 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40",
                activeTab === tab.id ? "text-cyan-300" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full bg-cyan-400"
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {activeTab === "inbox" ? (
          <InboxShell tenantId={tenantId} onOpenConfig={() => setActiveTab("config")} />
        ) : (
          <BotConfigEditor />
        )}
      </div>
    </div>
  );
}
