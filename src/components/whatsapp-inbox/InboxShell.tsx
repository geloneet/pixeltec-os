"use client";

import { useState } from "react";
import { MessageCircle, Settings2 } from "lucide-react";
import { useInboxConversations } from "@/hooks/use-inbox-conversations";
import { useWhatsappContacts } from "@/hooks/use-whatsapp-contacts";
import { ChatThread } from "./ChatThread";
import { ContactPanel } from "./ContactPanel";
import { ConversationList, type CategoryId, type QuickFilterId } from "./ConversationList";

interface InboxShellProps {
  tenantId: string;
  /** Cambia a la tab "Configuración del bot" del módulo. */
  onOpenConfig: () => void;
}

/**
 * Layout de dos paneles del inbox de WhatsApp.
 * - Desktop (≥768px): lista de conversaciones + hilo lado a lado.
 * - Mobile: un panel a la vez (lista ↔ hilo con botón de regreso).
 * El estado de filtros vive aquí para que el empty state central pueda
 * activar filtros de la lista.
 */
export function InboxShell({ tenantId, onOpenConfig }: InboxShellProps) {
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [category, setCategory] = useState<CategoryId>("todos");
  const [quickFilter, setQuickFilter] = useState<QuickFilterId | null>(null);
  const { contactsByPhone } = useWhatsappContacts();
  const {
    conversations,
    loading: conversationsLoading,
    error: conversationsError,
    refetch: refetchConversations,
  } = useInboxConversations();
  const selectedConv = conversations.find((c) => c.id === selectedPhone);

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
          conversations={conversations}
          loading={conversationsLoading}
          error={conversationsError}
          contactsByPhone={contactsByPhone}
          selectedPhone={selectedPhone}
          onSelect={setSelectedPhone}
          category={category}
          onCategoryChange={setCategory}
          quickFilter={quickFilter}
          onQuickFilterChange={setQuickFilter}
        />
      </div>

      {/* Panel central: hilo activo */}
      <div className={"min-w-0 flex-1 md:block " + (selectedPhone ? "block" : "hidden")}>
        {selectedPhone ? (
          <ChatThread
            key={selectedPhone}
            tenantId={tenantId}
            phone={selectedPhone}
            conv={selectedConv}
            onBack={() => setSelectedPhone(null)}
            contact={contactsByPhone.get(selectedPhone)}
            onOpenPanel={() => setPanelOpen((v) => !v)}
            refetchConversations={refetchConversations}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-6">
            <div className="w-full max-w-sm rounded-2xl border border-white/[0.06] bg-zinc-950/60 p-8 text-center shadow-xl backdrop-blur">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-cyan-500/20 bg-cyan-500/10">
                <MessageCircle className="h-6 w-6 text-cyan-400" />
              </div>
              <h2 className="text-base font-semibold text-zinc-100">
                Selecciona una conversación
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">
                Elige un chat del inbox para revisar mensajes, clasificar el contacto o tomar
                control humano.
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={onOpenConfig}
                  className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  Ver configuración del bot
                </button>
                <button
                  type="button"
                  onClick={() => setQuickFilter("sin_responder")}
                  className="inline-flex items-center rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
                >
                  Filtrar sin responder
                </button>
              </div>
            </div>
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
              conv={selectedConv}
              contact={contactsByPhone.get(selectedPhone)}
              onClose={() => setPanelOpen(false)}
              onModeChanged={refetchConversations}
            />
          </div>
        </>
      )}
    </div>
  );
}
