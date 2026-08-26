"use client";

/**
 * Pestaña «Cotizaciones» del workspace de cliente (WO-2026-00102).
 *
 * Documento plano hecho a mano: conceptos, importes, vigencia y notas. **Sin
 * IA en ningún punto** — es exactamente lo que pidió Miguel.
 *
 * Toda la aritmética viene de `@/lib/quotes/money`, que está cubierta por
 * tests: esta pantalla no calcula nada por su cuenta.
 */
import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2, FileDown, Mail, MessageCircle, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  computeTotals,
  formatMoney,
  parseMoneyToCents,
  centsToInput,
  lineTotalCents,
  validateQuote,
  type QuoteItem,
} from "@/lib/quotes/money";
import { buildWhatsAppLink } from "@/lib/quotes/share";
import { saveQuote, deleteQuote, sendQuoteByEmail, markQuoteShared } from "@/lib/quotes/actions";

export interface QuoteView {
  id: string;
  folio: string;
  title: string;
  items: QuoteItem[];
  taxEnabled: boolean;
  notes: string;
  validUntil: string | null;
  status: string;
  publicToken: string;
  sentAt: string | null;
  createdAt: string;
}

interface Props {
  clientId: string;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  quotes: QuoteView[];
  siteUrl: string;
  onChanged: () => void;
}

/** Fila del formulario: el precio se edita como texto para no pelear con el input. */
interface DraftItem {
  description: string;
  quantity: string;
  unitPrice: string;
}

const emptyRow = (): DraftItem => ({ description: "", quantity: "1", unitPrice: "" });

function toQuoteItems(rows: DraftItem[]): QuoteItem[] {
  return rows.map((r) => ({
    description: r.description,
    quantity: Number(r.quantity.replace(",", ".")) || 0,
    unitPriceCents: parseMoneyToCents(r.unitPrice) ?? 0,
  }));
}

function fromQuote(quote: QuoteView): DraftItem[] {
  return quote.items.map((i) => ({
    description: i.description,
    quantity: String(i.quantity),
    unitPrice: centsToInput(i.unitPriceCents),
  }));
}

function humanDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric" }).format(d);
}

export function CotizacionesTab({
  clientId,
  clientName,
  clientEmail,
  clientPhone,
  quotes,
  siteUrl,
  onChanged,
}: Props) {
  const [editing, setEditing] = useState<QuoteView | "new" | null>(null);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Cotizaciones</h2>
          <p className="text-xs text-muted-foreground">
            Documento simple: conceptos, importes y vigencia. Se envía por correo o WhatsApp.
          </p>
        </div>
        {editing === null ? (
          <Button type="button" size="sm" onClick={() => setEditing("new")}>
            <Plus className="mr-1.5 h-4 w-4" />
            Nueva cotización
          </Button>
        ) : null}
      </div>

      {editing !== null ? (
        <QuoteForm
          clientId={clientId}
          quote={editing === "new" ? null : editing}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged();
          }}
        />
      ) : quotes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">Todavía no hay cotizaciones para {clientName}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {quotes.map((quote) => (
            <QuoteCard
              key={quote.id}
              quote={quote}
              clientName={clientName}
              clientEmail={clientEmail}
              clientPhone={clientPhone}
              siteUrl={siteUrl}
              onEdit={() => setEditing(quote)}
              onChanged={onChanged}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tarjeta de una cotización ────────────────────────────────────────────────

function QuoteCard({
  quote,
  clientName,
  clientEmail,
  clientPhone,
  siteUrl,
  onEdit,
  onChanged,
}: {
  quote: QuoteView;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  siteUrl: string;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const [pending, start] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const totals = computeTotals(quote.items, quote.taxEnabled);
  const url = `${siteUrl}/c/${quote.publicToken}`;

  const waLink = buildWhatsAppLink(clientPhone, {
    clientName,
    folio: quote.folio,
    title: quote.title,
    total: formatMoney(totals.totalCents),
    url,
    validUntil: humanDate(quote.validUntil),
  });

  const sendEmail = () =>
    start(async () => {
      const res = await sendQuoteByEmail(quote.id);
      if (res.ok) {
        toast.success(`Enviada a ${res.data?.to}.`);
        onChanged();
      } else {
        toast.error(res.error ?? "No se pudo enviar.");
      }
    });

  const remove = () =>
    start(async () => {
      const res = await deleteQuote(quote.id);
      if (res.ok) {
        toast.success("Cotización borrada.");
        onChanged();
      } else {
        toast.error(res.error ?? "No se pudo borrar.");
      }
      setConfirmDelete(false);
    });

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <code className="text-xs text-muted-foreground">{quote.folio}</code>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-medium",
                quote.status === "enviada"
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {quote.status === "enviada" ? "Enviada" : "Borrador"}
            </span>
          </div>
          <p className="mt-1 truncate text-sm font-medium text-foreground">{quote.title}</p>
          <p className="text-xs text-muted-foreground">
            {quote.items.length} {quote.items.length === 1 ? "concepto" : "conceptos"}
            {quote.validUntil ? ` · vigente hasta el ${humanDate(quote.validUntil)}` : ""}
          </p>
        </div>
        <p className="text-lg font-semibold text-foreground">{formatMoney(totals.totalCents)}</p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="mr-1.5 h-3.5 w-3.5" />
          Editar
        </Button>
        <a
          href={`/api/documents/quote-pdf?id=${quote.id}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 items-center rounded-md border border-input px-3 text-xs font-medium transition-colors hover:bg-accent"
        >
          <FileDown className="mr-1.5 h-3.5 w-3.5" />
          PDF
        </a>
        <Button type="button" variant="outline" size="sm" onClick={sendEmail} disabled={pending || !clientEmail}>
          <Mail className="mr-1.5 h-3.5 w-3.5" />
          {pending ? "Enviando…" : "Enviar por correo"}
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
            WhatsApp
          </a>
        ) : null}
        <div className="ml-auto">
          {confirmDelete ? (
            <span className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">¿Seguro?</span>
              <Button type="button" variant="destructive" size="sm" onClick={remove} disabled={pending}>
                Borrar
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                Cancelar
              </Button>
            </span>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setConfirmDelete(true)}
              aria-label={`Borrar ${quote.folio}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {!clientEmail ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Este cliente no tiene correo registrado: el envío por correo está desactivado.
        </p>
      ) : null}
    </div>
  );
}

// ── Formulario ───────────────────────────────────────────────────────────────

function QuoteForm({
  clientId,
  quote,
  onCancel,
  onSaved,
}: {
  clientId: string;
  quote: QuoteView | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(quote?.title ?? "");
  const [rows, setRows] = useState<DraftItem[]>(quote ? fromQuote(quote) : [emptyRow()]);
  const [taxEnabled, setTaxEnabled] = useState(quote?.taxEnabled ?? true);
  const [notes, setNotes] = useState(quote?.notes ?? "");
  const [validUntil, setValidUntil] = useState(quote?.validUntil ? quote.validUntil.slice(0, 10) : "");
  const [saving, start] = useTransition();

  const items = useMemo(() => toQuoteItems(rows), [rows]);
  const totals = useMemo(() => computeTotals(items.filter((i) => i.description.trim()), taxEnabled), [items, taxEnabled]);
  const issues = validateQuote({ title, items, validUntil: validUntil || null });

  /**
   * Escribir en la última fila añade otra vacía debajo: agregar conceptos no
   * cuesta un clic. Se hace aquí y no con un efecto porque un efecto que llama
   * a `setRows` observando `rows` es una invitación a un bucle de render.
   */
  const patch = (index: number, next: Partial<DraftItem>) =>
    setRows((current) => {
      const updated = current.map((r, i) => (i === index ? { ...r, ...next } : r));
      const last = updated[updated.length - 1];
      return index === updated.length - 1 && last.description.trim() !== ""
        ? [...updated, emptyRow()]
        : updated;
    });

  const submit = () =>
    start(async () => {
      const res = await saveQuote({
        id: quote?.id,
        clientId,
        title,
        items,
        taxEnabled,
        notes,
        validUntil: validUntil || null,
      });
      if (res.ok) {
        toast.success(quote ? "Cotización actualizada." : "Cotización creada.");
        onSaved();
      } else {
        toast.error(res.error ?? "No se pudo guardar.");
      }
    });

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div>
        <p className="mb-1 text-xs text-muted-foreground">Título</p>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Sitio web institucional"
          aria-label="Título de la cotización"
        />
      </div>

      <div>
        <p className="mb-1 text-xs text-muted-foreground">Conceptos</p>
        <div className="space-y-2">
          {rows.map((row, index) => {
            const cents = parseMoneyToCents(row.unitPrice);
            const badPrice = row.unitPrice.trim() !== "" && cents === null;
            const item = items[index];
            return (
              <div key={index} className="flex flex-wrap items-start gap-2">
                <Input
                  value={row.description}
                  onChange={(e) => patch(index, { description: e.target.value })}
                  placeholder="Descripción del concepto"
                  aria-label={`Concepto ${index + 1}`}
                  className="min-w-[180px] flex-1"
                />
                <Input
                  value={row.quantity}
                  onChange={(e) => patch(index, { quantity: e.target.value })}
                  inputMode="decimal"
                  aria-label={`Cantidad del concepto ${index + 1}`}
                  className="w-20 text-right"
                />
                <Input
                  value={row.unitPrice}
                  onChange={(e) => patch(index, { unitPrice: e.target.value })}
                  inputMode="decimal"
                  placeholder="0.00"
                  aria-label={`Precio unitario del concepto ${index + 1}`}
                  className={cn("w-28 text-right", badPrice && "border-destructive")}
                />
                <span className="w-28 pt-2 text-right text-sm tabular-nums text-foreground">
                  {row.description.trim() && item ? formatMoney(lineTotalCents(item)) : "—"}
                </span>
                {rows.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Quitar concepto ${index + 1}`}
                    onClick={() => setRows((c) => c.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4 border-t border-border pt-4">
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={taxEnabled}
              onChange={(e) => setTaxEnabled(e.target.checked)}
              className="h-4 w-4"
            />
            Agregar IVA (16%)
          </label>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Vigencia (opcional)</p>
            <Input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              aria-label="Vigencia de la cotización"
              className="w-44"
            />
          </div>
        </div>

        <div className="w-52 space-y-1 text-sm tabular-nums">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>{formatMoney(totals.subtotalCents)}</span>
          </div>
          {taxEnabled ? (
            <div className="flex justify-between text-muted-foreground">
              <span>IVA 16%</span>
              <span>{formatMoney(totals.taxCents)}</span>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-border pt-1.5 text-base font-semibold text-foreground">
            <span>Total</span>
            <span>{formatMoney(totals.totalCents)}</span>
          </div>
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs text-muted-foreground">Notas (opcional)</p>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Formas de pago, tiempos de entrega, lo que no cabe en un concepto…"
          aria-label="Notas de la cotización"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={submit} disabled={saving || issues.length > 0}>
          {saving ? "Guardando…" : quote ? "Guardar cambios" : "Crear cotización"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        {issues.length > 0 ? <span className="text-xs text-muted-foreground">{issues[0].message}</span> : null}
      </div>
    </div>
  );
}
