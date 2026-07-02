"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";

interface InboxShellProps {
  tenantId: string;
}

/**
 * Layout de dos paneles del inbox de WhatsApp.
 * - Desktop (≥768px): lista de conversaciones + hilo lado a lado.
 * - Mobile: un panel a la vez (lista ↔ hilo con botón de regreso).
 */
export function InboxShell({ tenantId }: InboxShellProps) {
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);

  if (!tenantId) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-md rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 text-center">
          <MessageCircle className="mx-auto mb-3 h-8 w-8 text-amber-400" />
          <h2 className="mb-2 text-lg font-semibold text-zinc-100">Inbox no configurado</h2>
          <p className="text-sm text-zinc-400">
            Falta <code className="text-amber-300">PIXELBOT_TENANT_ID</code> en las variables de
            entorno. Obtén el id del tenant desde el SQLite de pixelbot y redeploy.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      {/* Panel izquierdo: lista de conversaciones */}
      <div
        className={
          "w-full border-r border-zinc-800/60 md:block md:w-80 lg:w-96 " +
          (selectedPhone ? "hidden" : "block")
        }
      >
        {/* Task 8 reemplaza este placeholder por <ConversationList /> */}
        <div className="p-4 text-sm text-zinc-500">Conversaciones…</div>
      </div>

      {/* Panel derecho: hilo activo */}
      <div className={"min-w-0 flex-1 md:block " + (selectedPhone ? "block" : "hidden")}>
        {/* Task 9 reemplaza este placeholder por <ChatThread /> */}
        <div className="flex h-full items-center justify-center text-sm text-zinc-500">
          {selectedPhone ?? "Selecciona una conversación"}
        </div>
      </div>
    </div>
  );
}
