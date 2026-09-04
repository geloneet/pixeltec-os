"use client";

/**
 * Vista de detalle de una cotización (WO-2026-00104 §16 y §21–§22).
 *
 * Es donde vive el flujo comercial: enviar, dar seguimiento, aceptar, rechazar
 * y crear el cobro. Todo lo que se muestra sale de la fuente única de cálculo.
 */
import { useEffect, useState, useTransition } from "react";
import {
  ArrowLeft,
  FileDown,
  Mail,
  MessageCircle,
  Pencil,
  CheckCircle2,
  XCircle,
  CalendarClock,
  Eye,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { isFirstYearFree, lineTotalCents, RECURRENCE_GRAND_LABEL } from "@/lib/quotes/money";
import {
  REJECTION_LABEL,
  REJECTION_REASONS,
  displayStatus,
  followUpLabel,
  formatAmount,
  formatDate,
  paymentSummary,
  annualRenewalSummary,
  breakdownFor,
  type RejectionReason,
} from "@/lib/quotes/terms";
import { buildWhatsAppLink } from "@/lib/quotes/share";
import { acceptQuote, markQuoteShared, rejectQuote, sendQuoteByEmail, snoozeFollowUp } from "@/lib/quotes/actions";
import { getProposalByQuoteId } from "@/lib/documents/proposals";
import { StatusBadge, type QuoteView } from "./quote-shared";
import { QuoteDocument } from "./quote-document";
import { AcceptDialog, SalePanel } from "./sale-panel";

function Block({ title, body }: { title: string; body: string }) {
  if (!body.trim()) return null;
  return (
    <section className="space-y-1.5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{body}</p>
    </section>
  );
}

export function QuoteDetail({
  quote,
  clientName,
  clientEmail,
  clientPhone,
  siteUrl,
  onBack,
  onEdit,
  onChanged,
}: {
  quote: QuoteView;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  siteUrl: string;
  onBack: () => void;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const [pending, start] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  // Vista previa como pop-up (orden de Miguel): el mismo documento que ve el
  // cliente, sin salir de la pantalla ni abrir otra pestaña.
  const [previewOpen, setPreviewOpen] = useState(false);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [reason, setReason] = useState<RejectionReason>("precio");
  const [comment, setComment] = useState("");
  // WO-2026-00222: si el botón "Crear brief con IA" del editor ya vinculó un
  // proposal a esta cotización, se ofrece su PDF junto al de la cotización.
  const [proposalId, setProposalId] = useState<string | null>(null);
  useEffect(() => {
    getProposalByQuoteId(quote.id)
      .then((p) => setProposalId(p?.id ?? null))
      .catch(() => undefined);
  }, [quote.id]);

  const now = new Date();
  const status = displayStatus(quote, now);
  // «Lista» es tan «sin enviar» como «Borrador» — solo cambia si le falta
  // algo. El CTA de enviar y su etiqueta tratan ambas igual.
  const notSent = status === "borrador" || status === "lista";
  // `breakdownFor(...).oneTime`, no `totalsFor`: este panel debe mostrar lo que
  // se cobra AL FIRMAR. `totalsFor` suma todos los conceptos, así que con una
  // mensualidad daba un «Total» que nadie va a pagar de una sola vez.
  const breakdown = breakdownFor(quote.items, quote.taxEnabled);
  const totals = breakdown.oneTime;
  const url = `${siteUrl}/c/${quote.publicToken}`;
  const follow = followUpLabel(quote.nextFollowUpAt, status, now);

  const waLink = buildWhatsAppLink(clientPhone, {
    clientName,
    folio: quote.folio,
    title: quote.title,
    total: `${formatAmount(totals.totalCents, quote.currency)} ${quote.currency}`,
    url,
    validUntil: formatDate(quote.validUntil),
  });

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okMessage: string) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(okMessage);
        onChanged();
      } else {
        toast.error(res.error ?? "No se pudo completar la acción.");
      }
    });

  return (
    <div className="space-y-6">
      <Button type="button" variant="ghost" size="sm" onClick={onBack} className="-ml-2">
        <ArrowLeft className="mr-1.5 h-4 w-4" />
        Cotizaciones
      </Button>

      {/* Encabezado (§16) */}
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <code className="text-xs text-muted-foreground">{quote.folio}</code>
          <StatusBadge status={status} />
          {follow ? (
            <span className="text-xs text-muted-foreground">
              <CalendarClock className="mr-1 inline h-3 w-3" />
              Seguimiento: {follow}
            </span>
          ) : null}
        </div>
        <h2 className="text-xl font-semibold text-foreground">{quote.title}</h2>
        <p className="text-sm text-muted-foreground">
          {clientName} · creada el {formatDate(quote.createdAt)}
          {quote.validUntil ? ` · válida hasta el ${formatDate(quote.validUntil)}` : ""}
        </p>
      </header>

      {/* Acciones (§16, §21, §22) */}
      <div className="flex flex-wrap items-center gap-2 border-y border-border py-3">
        <Button type="button" variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="mr-1.5 h-3.5 w-3.5" />
          Editar
        </Button>
        <a
          href={`/api/documents/quote-pdf?id=${quote.id}`}
          // El PDF se re-renderiza en cada petición, pero la URL era siempre la
          // misma y el visor de Chrome reusaba el que ya tenía en la pestaña:
          // un cambio de plantilla no se veía hasta forzar recarga. Se sella la
          // URL al pulsar —no al renderizar, que rompería la hidratación—.
          onClick={(e) => {
            e.currentTarget.href = `/api/documents/quote-pdf?id=${quote.id}&t=${Date.now()}`;
          }}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 items-center rounded-md border border-input px-3 text-xs font-medium transition-colors hover:bg-accent"
        >
          <FileDown className="mr-1.5 h-3.5 w-3.5" />
          PDF
        </a>
        {proposalId ? (
          <a
            href={`/api/documents/proposal-pdf?proposalId=${proposalId}`}
            onClick={(e) => {
              e.currentTarget.href = `/api/documents/proposal-pdf?proposalId=${proposalId}&t=${Date.now()}`;
            }}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center rounded-md border border-input px-3 text-xs font-medium transition-colors hover:bg-accent"
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            Propuesta (PDF)
          </a>
        ) : null}
        <Button type="button" variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
          <Eye className="mr-1.5 h-3.5 w-3.5" />
          Vista previa
        </Button>
        {/* Con la cotización creada, el siguiente paso natural es enviarla: es
            la acción principal mientras siga en borrador. Editar, PDF y vista
            previa quedan como secundarias. */}
        <Button
          type="button"
          variant={notSent ? "default" : "outline"}
          size="sm"
          onClick={() => run(() => sendQuoteByEmail(quote.id), "Enviada por correo.")}
          disabled={pending || !clientEmail}
        >
          <Mail className="mr-1.5 h-3.5 w-3.5" />
          {notSent ? "Enviar cotización" : "Enviar por correo"}
        </Button>
        {waLink ? (
          <a
            href={waLink}
            target="_blank"
            rel="noreferrer"
            onClick={() => void markQuoteShared(quote.id).then(onChanged)}
            className="inline-flex h-8 items-center rounded-md border border-input px-3 text-xs font-medium transition-colors hover:bg-accent"
          >
            <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
            Compartir por WhatsApp
          </a>
        ) : null}

        <span className="ml-auto flex flex-wrap items-center gap-2">
          {status === "enviada" || status === "vencida" ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => run(() => snoozeFollowUp(quote.id), "Seguimiento en 7 días.")}
                disabled={pending}
              >
                <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
                Seguir en 7 días
              </Button>
              <Button type="button" size="sm" onClick={() => setAcceptOpen(true)}>
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                Marcar como aceptada
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setRejecting((v) => !v)}>
                <XCircle className="mr-1.5 h-3.5 w-3.5" />
                Marcar como rechazada
              </Button>
            </>
          ) : null}
          {/* «Lista» (nada pendiente, aún no enviada por el sistema) también
              se puede aceptar directo: entregada impresa o en persona no es
              menos válida que por WhatsApp o correo — mismo criterio que
              displayStatus() ya documenta. Sin «Seguir en 7 días» aquí: ese
              seguimiento presupone que ya se envió y se espera respuesta. */}
          {status === "lista" ? (
            <Button type="button" size="sm" onClick={() => setAcceptOpen(true)}>
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              Marcar como aceptada
            </Button>
          ) : null}
        </span>
      </div>

      {/* Rechazo (§23) */}
      {rejecting ? (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-medium text-foreground">¿Por qué se perdió?</p>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as RejectionReason)}
            aria-label="Motivo del rechazo"
            className="h-9 w-full max-w-xs rounded-md border border-input bg-background px-2 text-sm"
          >
            {REJECTION_REASONS.map((r) => (
              <option key={r} value={r}>
                {REJECTION_LABEL[r]}
              </option>
            ))}
          </select>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            placeholder="Comentario (opcional)"
            aria-label="Comentario del rechazo"
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={() => {
                run(() => rejectQuote({ id: quote.id, reason, comment }), "Marcada como rechazada.");
                setRejecting(false);
              }}
            >
              Guardar rechazo
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setRejecting(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}

      {quote.rejection ? (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm">
          <p className="font-medium text-foreground">Rechazada: {REJECTION_LABEL[quote.rejection.reason]}</p>
          {quote.rejection.comment ? <p className="mt-1 text-muted-foreground">{quote.rejection.comment}</p> : null}
        </div>
      ) : null}

      <AcceptDialog quoteId={quote.id} open={acceptOpen} onOpenChange={setAcceptOpen} onAccepted={onChanged} />

      {/* §10: tras aceptar, el resumen aparece aquí mismo — nada de pantallas
          vacías ni de ir a Finanzas a capturar de nuevo. */}
      {status === "aceptada" ? (
        <SalePanel quotationId={quote.id} onOpenCharges={() => window.open("/cobros", "_blank")} />
      ) : null}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm font-medium text-muted-foreground">
              Vista previa · así la recibe el cliente
            </DialogTitle>
          </DialogHeader>
          <div className="pt-2">
            <QuoteDocument quote={quote} clientName={clientName} />
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <a
              href={`/api/documents/quote-pdf?id=${quote.id}`}
              onClick={(e) => {
                e.currentTarget.href = `/api/documents/quote-pdf?id=${quote.id}&t=${Date.now()}`;
              }}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center rounded-md border border-input px-3 text-xs font-medium transition-colors hover:bg-accent"
            >
              <FileDown className="mr-1.5 h-3.5 w-3.5" />
              Descargar PDF
            </a>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Abrir el enlace público
            </a>
          </div>
        </DialogContent>
      </Dialog>

      {/* Contenido */}
      <div className="space-y-6">
        <Block title="El problema" body={quote.problem} />
        <Block title="Solución propuesta" body={quote.solution} />
        <Block title="Alcance incluido" body={quote.scopeIncluded} />

        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Inversión</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Concepto</th>
                  <th className="py-2 px-3 text-right font-medium">Cant.</th>
                  <th className="py-2 px-3 text-right font-medium">P. unitario</th>
                  <th className="py-2 pl-3 text-right font-medium">Importe</th>
                </tr>
              </thead>
              <tbody>
                {quote.items.map((item, i) => (
                  <tr key={i} className="border-b border-border/60">
                    <td className="py-2.5 pr-3 text-foreground">{item.description}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">
                      {Number.isInteger(item.quantity) ? item.quantity : item.quantity.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">
                      {formatAmount(item.unitPriceCents, quote.currency)}
                    </td>
                    <td className="py-2.5 pl-3 text-right tabular-nums text-foreground">
                      {isFirstYearFree(item) ? (
                        <span className="text-muted-foreground">
                          <span className="line-through">{formatAmount(lineTotalCents(item), quote.currency)}</span>{" "}
                          <span className="text-xs">1.er año incluido</span>
                        </span>
                      ) : (
                        formatAmount(lineTotalCents(item), quote.currency)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end">
            <dl className="w-56 space-y-1 text-sm tabular-nums">
              <div className="flex justify-between text-muted-foreground">
                <dt>Subtotal</dt>
                <dd>{formatAmount(totals.subtotalCents, quote.currency)}</dd>
              </div>
              {quote.taxEnabled ? (
                <div className="flex justify-between text-muted-foreground">
                  <dt>IVA 16%</dt>
                  <dd>{formatAmount(totals.taxCents, quote.currency)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-border pt-1.5 text-base font-semibold text-foreground">
                <dt>{breakdown.recurring.length > 0 || breakdown.annualRenewal ? "Total inicial" : "Total"}</dt>
                <dd>
                  {formatAmount(totals.totalCents, quote.currency)} {quote.currency}
                </dd>
              </div>
              {/* Lo que no se cobra hoy, dicho aquí y no solo en el documento:
                  quien mira este panel decide sobre el cobro. */}
              {breakdown.recurring.map(({ recurrence, totals: t }) => (
                <div key={recurrence} className="flex justify-between pt-1.5 text-sm text-muted-foreground">
                  <dt>{RECURRENCE_GRAND_LABEL[recurrence]}</dt>
                  <dd>
                    {formatAmount(t.totalCents, quote.currency)} {quote.currency}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <Block title="Tiempo estimado" body={quote.estimatedDelivery} />
        <Block title="Forma de pago" body={paymentSummary(totals.totalCents, quote.paymentTerms, quote.currency)} />
        {/* Mismo criterio que el documento del cliente: la renovación se
            explica aquí, después de la forma de pago, no en la columna de
            totales (Miguel, 2026-08-27). */}
        {breakdown.annualRenewal ? (
          <Block
            title="Renovación anual"
            body={annualRenewalSummary(
              breakdown.annualRenewal,
              quote.taxEnabled,
              quote.currency,
              quote.items.some(isFirstYearFree),
            )}
          />
        ) : null}
        <Block title="Fuera de alcance" body={quote.exclusions} />
        <Block title="Notas y condiciones" body={quote.notes} />
      </div>
    </div>
  );
}
