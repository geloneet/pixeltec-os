"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { useWhatsappContacts } from "@/hooks/use-whatsapp-contacts";
import { ChatThread } from "./ChatThread";
import { ContactPanel } from "./ContactPanel";
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
  const [panelOpen, setPanelOpen] = useState(true);
  const { contactsByPhone } = useWhatsappContacts();

  if (!tenantId) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-md rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 text-center">
          <MessageCircle className="mx-auto mb-3 h-8 w-8 text-amber-400" />
          <h2 className="mb-2 text-lg font-semibold text-zinc-100">Inbox no configurado</h2>
          <p className="text-sm text-zinc-400">
            Falta <code className="text-amber-300">PIXELBOT_TENANT_ID</code> en las variables de
            entorno. Obtén el id del tenant desde el SQLite de pixelbot y vuelve a desplegar.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 overflow-hidden">
      {/* Panel izquierdo: lista de conversaciones */}
      <div
        className={
          "min-h-0 w-full border-r border-zinc-800/60 md:block md:w-80 md:flex-shrink-0 lg:w-[22.5rem] " +
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
            contact={contactsByPhone.get(selectedPhone)}
            onOpenPanel={() => setPanelOpen((v) => !v)}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">
            Selecciona una conversación
          </div>
        )}
      </div>

      {/* Panel derecho: ficha del contacto — slide-over con scrim en <xl, columna normal en xl+ */}
      {panelOpen && selectedPhone && (
        <>
          <button
            type="button"
            aria-label="Cerrar panel de contacto"
            onClick={() => setPanelOpen(false)}
            className="absolute inset-0 z-10 cursor-default bg-black/50 backdrop-blur-[2px] animate-in fade-in-0 duration-200 xl:hidden"
          />
          <div className="absolute inset-y-0 right-0 z-20 w-80 max-w-[85vw] shrink-0 border-l border-zinc-800/60 bg-[#0a0a0b] shadow-2xl animate-in slide-in-from-right-4 duration-200 xl:static xl:z-auto xl:max-w-none xl:animate-none xl:shadow-none">
            <ContactPanel
              key={selectedPhone}
              tenantId={tenantId}
              phone={selectedPhone}
              contact={contactsByPhone.get(selectedPhone)}
              onClose={() => setPanelOpen(false)}
            />
          </div>
        </>
      )}
    </div>
  );
}
