"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { useWhatsappContacts } from "@/hooks/use-whatsapp-contacts";
import { ChatThread } from "./ChatThread";
import { ConversationList } from "./ConversationList";

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
  // El panel de contacto se agrega en Task 8; el estado ya vive aquí para
  // que ese trabajo solo tenga que montar el panel, no cablear el toggle.
  const [panelOpen] = useState(true);
  const { contactsByPhone } = useWhatsappContacts();

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
        <ConversationList
          tenantId={tenantId}
          contactsByPhone={contactsByPhone}
          selectedPhone={selectedPhone}
          onSelect={setSelectedPhone}
        />
      </div>

      {/* Panel central: hilo activo */}
      <div className={"min-w-0 flex-1 md:block " + (selectedPhone ? "block" : "hidden")}>
        {selectedPhone ? (
          <ChatThread
            key={selectedPhone}
            tenantId={tenantId}
            phone={selectedPhone}
            onBack={() => setSelectedPhone(null)}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">
            Selecciona una conversación
          </div>
        )}
      </div>

      {/* Panel derecho: ficha del contacto */}
      {panelOpen && selectedPhone && (
        <div className="hidden w-80 flex-shrink-0 border-l border-zinc-800/60 lg:block">
          {/* Task 8: ContactPanel */}
        </div>
      )}
    </div>
  );
}
