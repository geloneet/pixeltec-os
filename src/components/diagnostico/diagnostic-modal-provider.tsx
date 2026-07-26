'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DiagnosticWizard } from '@/components/diagnostico/DiagnosticWizard';

type DiagnosticModalValue = { openDiagnostic: () => void };

const DiagnosticModalContext = createContext<DiagnosticModalValue | null>(null);

/**
 * Frontera cliente acotada: existe UNA sola instancia del wizard para toda la
 * página. Los disparadores (hero, servicios, CTA de diagnóstico) piden abrirlo
 * por contexto en lugar de montar cada uno su propio Dialog, que divergiría.
 *
 * `page.tsx` sigue siendo Server Component: solo envuelve a sus hijos con este
 * proveedor. Radix conserva el focus management y devuelve el foco al trigger.
 */
export function DiagnosticModalProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const openDiagnostic = useCallback(() => setOpen(true), []);
  const value = useMemo(() => ({ openDiagnostic }), [openDiagnostic]);

  return (
    <DiagnosticModalContext.Provider value={value}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl border-none bg-transparent p-0 shadow-none">
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
