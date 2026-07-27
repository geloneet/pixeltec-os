'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DiagnosticWizard } from '@/components/diagnostico/DiagnosticWizard';

type DiagnosticModalValue = {
  /**
   * Abre el modal. `trigger` es opcional: si no se pasa, se toma el elemento
   * enfocado en ese instante, que es el botón que acaba de activarse.
   */
  openDiagnostic: (trigger?: HTMLElement | null) => void;
};

const DiagnosticModalContext = createContext<DiagnosticModalValue | null>(null);

/**
 * Frontera cliente acotada: existe UNA sola instancia del wizard para toda la
 * página. Los disparadores (hero, servicios, CTA de diagnóstico) piden abrirlo
 * por contexto en lugar de montar cada uno su propio Dialog, que divergiría.
 *
 * `page.tsx` sigue siendo Server Component: solo envuelve a sus hijos con este
 * proveedor.
 *
 * Retorno de foco: Radix restaura el foco por sí solo cuando el diálogo se abre
 * desde un `DialogTrigger`, porque entonces conoce el elemento de origen. Aquí
 * no hay trigger declarativo —los botones piden la apertura por contexto—, así
 * que Radix no tiene a dónde volver y el foco terminaba en el documento. El
 * origen se guarda explícitamente al abrir y se restaura en `onCloseAutoFocus`.
 */
export function DiagnosticModalProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  // Elemento que pidió la apertura. Se captura AL ABRIR y no al cerrar: para
  // cuando el diálogo se cierra, el foco ya se movió dentro del modal y
  // `document.activeElement` habría dejado de señalar al disparador.
  const triggerRef = useRef<HTMLElement | null>(null);

  const openDiagnostic = useCallback((trigger?: HTMLElement | null) => {
    const activo = typeof document !== 'undefined' ? document.activeElement : null;
    triggerRef.current = trigger ?? (activo instanceof HTMLElement ? activo : null);
    setOpen(true);
  }, []);

  const value = useMemo(() => ({ openDiagnostic }), [openDiagnostic]);

  return (
    <DiagnosticModalContext.Provider value={value}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-2xl border-none bg-transparent p-0 shadow-none"
          onCloseAutoFocus={(event) => {
            const trigger = triggerRef.current;
            triggerRef.current = null;
            // `isConnected` cubre el caso de un disparador desmontado mientras
            // el modal estaba abierto: enfocar un nodo separado del documento no
            // hace nada y dejaría el foco perdido. Si no hay a dónde volver, no
            // se llama a preventDefault y Radix aplica su restauración por
            // defecto — fallback seguro, sin excepción.
            if (!trigger?.isConnected) return;
            event.preventDefault();
            trigger.focus();
          }}
        >
          <DialogTitle className="sr-only">Diagnóstico Inteligente PixelTEC</DialogTitle>
          <DialogDescription className="sr-only">
            Responde unas preguntas y recibe una recomendación personalizada para tu empresa.
          </DialogDescription>
          <DiagnosticWizard variant="modal" onClose={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </DiagnosticModalContext.Provider>
  );
}

/** Devuelve `null` fuera del proveedor para que un consumidor suelto no rompa la página. */
export function useDiagnosticModal() {
  return useContext(DiagnosticModalContext);
}
