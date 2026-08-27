"use client";

/**
 * Formulario de cotización (WO-2026-00104 §26).
 *
 * Una sola pantalla, sin wizard, en cinco bloques: Información · Propuesta ·
 * Conceptos · Condiciones · Resumen. **Sin IA en ningún punto.**
 *
 * No calcula nada por su cuenta: importes, IVA, total y reparto de pagos salen
 * de `@/lib/quotes/money` y `@/lib/quotes/terms`, que están cubiertos por tests
 * (§30, fuente única).
 */
import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { lineTotalCents, parseMoneyToCents, validateQuote } from "@/lib/quotes/money";
import {
  CURRENCIES,
  DEFAULT_EXCLUSIONS,
  DEFAULT_PAYMENT_TERMS,
  PAYMENT_LABEL,
  PAYMENT_TYPES,
  defaultValidUntil,
  formatAmount,
  formatDate,
  paymentSchedule,
  totalsFor,
  type Currency,
  type PaymentType,
} from "@/lib/quotes/terms";
import { saveQuote } from "@/lib/quotes/actions";
import { FormSection, Field, emptyRow, fromQuote, toQuoteItems, type DraftItem, type QuoteView } from "./quote-shared";

/** `YYYY-MM-DD` para el input date. */
function toDateInput(value: Date | string | null): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function QuoteForm({
  clientId,
  quote,
  onCancel,
  onSaved,
}: {
  clientId: string;
  quote: QuoteView | null;
  onCancel: () => void;
  onSaved: (id: string) => void;
}) {
  const [title, setTitle] = useState(quote?.title ?? "");
  const [currency, setCurrency] = useState<Currency>(quote?.currency ?? "MXN");
  // §6 y §27: una cotización nueva nace con vigencia a 15 días, editable.
  const [validUntil, setValidUntil] = useState(
    toDateInput(quote ? quote.validUntil : defaultValidUntil(new Date())),
  );
  const [problem, setProblem] = useState(quote?.problem ?? "");
  const [solution, setSolution] = useState(quote?.solution ?? "");
  const [rows, setRows] = useState<DraftItem[]>(quote ? fromQuote(quote) : [emptyRow()]);
  const [taxEnabled, setTaxEnabled] = useState(quote?.taxEnabled ?? true);
  const [scopeIncluded, setScopeIncluded] = useState(quote?.scopeIncluded ?? "");
  // §10 y §27: las exclusiones estándar vienen precargadas y son editables.
  const [exclusions, setExclusions] = useState(quote?.exclusions ?? DEFAULT_EXCLUSIONS);
  const [estimatedDelivery, setEstimatedDelivery] = useState(quote?.estimatedDelivery ?? "");
  const [paymentType, setPaymentType] = useState<PaymentType>(quote?.paymentTerms.type ?? DEFAULT_PAYMENT_TERMS.type);
  const [paymentCustom, setPaymentCustom] = useState(quote?.paymentTerms.custom ?? "");
  const [notes, setNotes] = useState(quote?.notes ?? "");
  const [saving, start] = useTransition();

  const items = useMemo(() => toQuoteItems(rows), [rows]);
  const totals = useMemo(() => totalsFor(items, taxEnabled), [items, taxEnabled]);
  const schedule = useMemo(
    () => paymentSchedule(totals.totalCents, { type: paymentType, custom: paymentCustom }),
    [totals.totalCents, paymentType, paymentCustom],
  );
  // §29: guardar borrador solo exige título y un concepto válido.
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
      return index === updated.length - 1 && last.description.trim() !== "" ? [...updated, emptyRow()] : updated;
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
        currency,
        problem,
        solution,
        scopeIncluded,
        exclusions,
        estimatedDelivery,
        paymentTerms: { type: paymentType, custom: paymentCustom },
      });
      if (res.ok && res.data) {
        toast.success(quote ? "Cambios guardados." : "Borrador guardado.");
        onSaved(res.data.id);
      } else {
        toast.error(res.error ?? "No se pudo guardar.");
      }
    });

  return (
    <div className="space-y-6 rounded-xl border border-border bg-card p-5">
      {/* ── Información ─────────────────────────────────────────────────── */}
      <FormSection title="Información">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto]">
          <Field label="Título">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Sistema de citas Smile More"
              aria-label="Título de la cotización"
            />
          </Field>
          <Field label="Moneda">
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
              aria-label="Moneda"
              className="h-9 w-24 rounded-md border border-input bg-background px-2 text-sm focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Vigencia" hint={formatDate(validUntil) ? `Válida hasta: ${formatDate(validUntil)}` : undefined}>
            <Input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              aria-label="Vigencia"
              className="w-44"
            />
          </Field>
        </div>
      </FormSection>

      {/* ── Propuesta ───────────────────────────────────────────────────── */}
      <FormSection title="Propuesta">
        <Field label="Problema a resolver">
          <Textarea
            value={problem}
            onChange={(e) => setProblem(e.target.value)}
            rows={3}
            aria-label="Problema a resolver"
            placeholder="Actualmente las citas se administran por WhatsApp y Excel, generando duplicidad y pérdida de seguimiento."
          />
        </Field>
        <Field label="Solución propuesta">
          <Textarea
            value={solution}
            onChange={(e) => setSolution(e.target.value)}
            rows={3}
            aria-label="Solución propuesta"
            placeholder="Implementaremos una plataforma web que centralice clientes, agenda y seguimiento de citas."
          />
        </Field>
      </FormSection>

      {/* ── Conceptos ───────────────────────────────────────────────────── */}
      <FormSection title="Conceptos">
        <div className="hidden gap-2 px-1 text-[11px] uppercase tracking-wide text-muted-foreground sm:flex">
          <span className="flex-1">Concepto</span>
          <span className="w-20 text-right">Cantidad</span>
          <span className="w-28 text-right">P. unitario</span>
          <span className="w-28 text-right">Importe</span>
          <span className="w-9" />
        </div>
        <div className="space-y-2">
          {rows.map((row, index) => {
            const badPrice = row.unitPrice.trim() !== "" && parseMoneyToCents(row.unitPrice) === null;
            const item = items[index];
            const filled = row.description.trim() !== "";
            return (
              <div key={index} className="flex flex-wrap items-start gap-2">
                <Input
                  value={row.description}
                  onChange={(e) => patch(index, { description: e.target.value })}
                  placeholder="Desarrollo de sitio web"
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
                {/* §3: el importe NUNCA se captura, se calcula. */}
                <span className="w-28 pt-2 text-right text-sm tabular-nums text-foreground">
                  {filled && item ? formatAmount(lineTotalCents(item), currency) : "—"}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-9"
                  aria-label={`Quitar concepto ${index + 1}`}
                  disabled={rows.length === 1}
                  onClick={() => setRows((c) => c.filter((_, i) => i !== index))}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setRows((c) => [...c, emptyRow()])}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Agregar concepto
        </Button>
      </FormSection>

      {/* ── Condiciones ─────────────────────────────────────────────────── */}
      <FormSection title="Condiciones">
        <Field label="Alcance incluido">
          <Textarea
            value={scopeIncluded}
            onChange={(e) => setScopeIncluded(e.target.value)}
            rows={4}
            aria-label="Alcance incluido"
            placeholder={"Landing page\nPanel administrativo\nGestión de clientes\nAgenda\nCapacitación inicial"}
          />
        </Field>
        <Field label="Fuera de alcance" hint="Vienen tres exclusiones estándar; edítalas si hace falta.">
          <Textarea
            value={exclusions}
            onChange={(e) => setExclusions(e.target.value)}
            rows={4}
            aria-label="Fuera de alcance"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tiempo estimado">
            <Input
              value={estimatedDelivery}
              onChange={(e) => setEstimatedDelivery(e.target.value)}
              placeholder="4 semanas"
              aria-label="Tiempo estimado"
            />
          </Field>
          <Field label="Forma de pago">
            <select
              value={paymentType}
              onChange={(e) => setPaymentType(e.target.value as PaymentType)}
              aria-label="Forma de pago"
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
            >
              {PAYMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {PAYMENT_LABEL[t]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {paymentType === "personalizada" ? (
          <Field label="Condiciones de pago">
            <Textarea
              value={paymentCustom}
              onChange={(e) => setPaymentCustom(e.target.value)}
              rows={2}
              aria-label="Condiciones de pago"
              placeholder="Tres pagos: al inicio, a la mitad y contra entrega."
            />
          </Field>
        ) : schedule.length > 0 ? (
          <ul className="space-y-1 text-xs text-muted-foreground">
            {schedule.map((i) => (
              <li key={i.label}>
                {i.label} {i.percent}% — <span className="tabular-nums">{formatAmount(i.amountCents, currency)}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <Field label="Notas y condiciones adicionales">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            aria-label="Notas y condiciones adicionales"
            placeholder="Número de revisiones, tiempos de respuesta, soporte, qué debe entregar el cliente…"
          />
        </Field>
      </FormSection>

      {/* ── Resumen ─────────────────────────────────────────────────────── */}
      <FormSection title="Resumen">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={taxEnabled}
              onChange={(e) => setTaxEnabled(e.target.checked)}
              className="h-4 w-4"
            />
            Agregar IVA (16%)
          </label>
          <dl className="w-56 space-y-1 text-sm tabular-nums">
            <div className="flex justify-between text-muted-foreground">
              <dt>Subtotal</dt>
              <dd>{formatAmount(totals.subtotalCents, currency)}</dd>
            </div>
            {taxEnabled ? (
              <div className="flex justify-between text-muted-foreground">
                <dt>IVA 16%</dt>
                <dd>{formatAmount(totals.taxCents, currency)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-border pt-1.5 text-base font-semibold text-foreground">
              <dt>Total</dt>
              <dd>
                {formatAmount(totals.totalCents, currency)} {currency}
              </dd>
            </div>
          </dl>
        </div>
      </FormSection>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <Button type="button" onClick={submit} disabled={saving || issues.length > 0}>
          {saving ? "Guardando…" : quote ? "Guardar cambios" : "Guardar borrador"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        {issues.length > 0 ? <span className="text-xs text-muted-foreground">{issues[0].message}</span> : null}
      </div>
    </div>
  );
}
