import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getQuoteByToken } from '@/lib/quotes/queries';
import { QuoteDocument } from '@/components/crm/workspace-tabs/quote-document';

/**
 * Vista pública de una cotización (WO-2026-00102).
 *
 * Solo lectura, sin sesión y **sin acciones del cliente**: no hay aceptar, ni
 * comentar, ni formularios.
 *
 * El documento lo pinta `QuoteDocument`, el MISMO componente que usa la vista
 * previa en pop-up del panel: así lo que Miguel revisa antes de enviar es
 * literalmente lo que abre el cliente, no una copia que se desincroniza.
 *
 * `noindex`: una cotización lleva precios de un cliente concreto y no tiene
 * nada que hacer en Google.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function PublicQuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const quote = await getQuoteByToken(token);
  if (!quote) notFound();

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-16">
      <QuoteDocument quote={quote} clientName={quote.clientName} />
      <footer className="mt-12 border-t border-border pt-6 text-xs text-muted-foreground">
        ¿Dudas sobre esta cotización? Responde el correo o escríbenos por WhatsApp.
      </footer>
    </main>
  );
}
