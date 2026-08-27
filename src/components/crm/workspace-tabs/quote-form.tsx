"use client";

/**
 * Editor de cotización (WO-2026-00104 §26 · segunda pasada visual).
 *
 * Una sola pantalla, sin wizard, en dos columnas: el editor a la izquierda y
 * el resumen económico fijo a la derecha, para que el total y el CTA no se
 * pierdan al hacer scroll. **Sin IA en ningún punto.**
 *
 * No calcula nada por su cuenta: importes, IVA, total y reparto de pagos salen
 * de `@/lib/quotes/money` y `@/lib/quotes/terms`, que están cubiertos por tests
 * (§30, fuente única). Esta pasada NO tocó ni un cálculo ni un estado.
 *
 * Nota sobre el `sticky`: el scroll del panel NO es el de la ventana — el
 * shell del admin scrollea en un `div` con `overflow-y-auto`
 * (`src/app/(admin)/layout.tsx`). El elemento se ancla a ese contenedor, que ya
 * empieza bajo la barra superior: compensar los 64 px del header dejaría un
 * hueco, por eso el offset es pequeño y no la altura del header.
 */
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  RECURRENCES,
  RECURRENCE_LABEL,
  RECURRENCE_TOTAL_LABEL,
  RECURRENCE_GRAND_LABEL,
  RECURRENCE_SUBTOTAL_LABEL,
  lineTotalCents,
  parseMoneyToCents,
  validateQuote,
  type Recurrence,
} from "@/lib/quotes/money";
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
  breakdownFor,
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

/** Líneas con contenido — alimenta el resumen del bloque colapsado. */
function countLines(text: string): number {
  return text.split("\n").filter((l) => l.trim()).length;
}

/**
 * Textarea que crece con su contenido, sin librerías.
 *
 * La medida va en un efecto sobre `value`, no en el evento `input` del DOM:
 * ese evento se dispara ANTES de que React repinte, así que medir ahí deja la
 * altura un render atrás. Se comprobó en el navegador — con cinco líneas de
 * texto el campo se quedaba mostrando cuatro. El efecto corre después del
 * commit, así que mide siempre el contenido real.
 */
function AutoTextarea({
  value,
  ...props
}: React.ComponentProps<typeof Textarea> & { value: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return <Textarea ref={ref} value={value} {...props} />;
}

/**
 * Ancho cómodo de lectura (en un monitor grande, una línea de 200 caracteres no
 * se lee) y `min-h-0` para que `rows` y el auto-grow manden de verdad: el
 * `Textarea` base impone `min-h-[80px]`, que sin esto deja los campos de prosa
 * a cuatro líneas por mucho que se pida `rows={2}` (medido en el navegador).
 */
const PROSE = "max-w-[62ch]";
// `resize-none`: con el auto-grow, arrastrar la esquina se deshace al
// siguiente tecleo — mejor no ofrecer un gesto que no se sostiene.
const PROSE_INPUT = "min-h-0 resize-none";

const SELECT_CLASS =
  "h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none";

/**
 * Celda editable de la tabla de conceptos. En reposo se lee como una tabla; al
 * pasar el ratón o al enfocar deja de haber duda de que se puede escribir.
 * Sin cajas permanentes: eso devolvería el ruido que quitamos.
 */
const CELL =
  "border-transparent bg-transparent px-2 transition-colors " +
  "hover:border-input hover:bg-accent/40 " +
  "focus-visible:border-input focus-visible:bg-accent/30 focus-visible:ring-1 focus-visible:ring-ring";

export function QuoteForm({
  clientId,
  clientName,
  quote,
  onCancel,
  onSaved,
}: {
  clientId: string;
  clientName: string;
  quote: QuoteView | null;
  onCancel: () => void;
  onSaved: (id: string) => void;
}) {
  const [title, setTitle] = useState(quote?.title ?? "");
  const [currency, setCurrency] = useState<Currency>(quote?.currency ?? "MXN");
  // §6 y §27: una cotización nueva nace con vigencia a 15 días, editable.
  const [validUntil, setValidUntil] = useState(toDateInput(quote ? quote.validUntil : defaultValidUntil(new Date())));
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

  // Progressive disclosure — solo presentación, el contenido siempre se guarda.
  const [exclusionsOpen, setExclusionsOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(Boolean(quote?.notes?.trim()));

  const [saving, start] = useTransition();
  // Qué fila de precio está enfocada: enfocada se edita en crudo, fuera de
  // foco se lee como dinero. `parseMoneyToCents` ya acepta «$25,000.00».
  const [priceFocus, setPriceFocus] = useState<number | null>(null);
  const priceRefs = useRef<(HTMLInputElement | null)[]>([]);

  const items = useMemo(() => toQuoteItems(rows), [rows]);
  const breakdown = useMemo(() => breakdownFor(items, taxEnabled), [items, taxEnabled]);
  const totals = breakdown.oneTime;
  // El reparto de anticipos SOLO aplica a lo que se paga una vez: un «50% de
  // anticipo» sobre una mensualidad no significa nada.
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

  /**
   * El botón describe lo que hace el USUARIO, no el estado técnico. Al crear,
   * la acción es «crear la cotización» aunque por dentro nazca en BORRADOR:
   * «Guardar borrador» sugería un proceso a medias con la cotización ya lista,
   * y dejaba al usuario preguntándose qué falta. El envío es una acción aparte
   * y explícita, desde el detalle.
   */
  const saveLabel = saving ? "Guardando…" : quote ? "Guardar cambios" : "Crear cotización";

  return (
    // Sin mega-card (§1): la superficie es el fondo de la página. Dos columnas
    // en desktop, una sola apilada en móvil con el resumen al final (§13).
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start lg:gap-12">
      {/* ── Editor ─────────────────────────────────────────────────────── */}
      <div className="min-w-0 space-y-7">
        {/* Encabezado contextual: con varias cotizaciones abiertas, saber cuál
            es esta y de quién no debería costar un clic. */}
        <p className="text-xs text-muted-foreground">
          <span className="text-foreground/80">{quote ? quote.folio : "Nueva cotización"}</span>
          {clientName ? <> · {clientName}</> : null}
        </p>

        <FormSection title="Información">
          <div className="flex flex-wrap items-end gap-4">
            <Field label="Título" className="min-w-[220px] flex-1">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Sistema de citas"
                aria-label="Título de la cotización"
              />
            </Field>
            <Field label="Moneda">
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
                aria-label="Moneda"
                className={cn(SELECT_CLASS, "w-24")}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Vigencia">
              <Input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                aria-label="Vigencia"
                className="w-40"
              />
            </Field>
          </div>
          {formatDate(validUntil) ? (
            <p className="text-xs text-muted-foreground">Válida hasta el {formatDate(validUntil)}.</p>
          ) : null}
        </FormSection>

        <FormSection title="Propuesta">
          {/* §3: dos o tres líneas de arranque, no dos superficies enormes. */}
          <Field label="Problema a resolver" className={PROSE}>
            <AutoTextarea
              className={PROSE_INPUT}
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              rows={2}
              aria-label="Problema a resolver"
              placeholder="Las citas se administran por WhatsApp y Excel, generando duplicidad."
            />
          </Field>
          <Field label="Solución propuesta" className={PROSE}>
            <AutoTextarea
              className={PROSE_INPUT}
              value={solution}
              onChange={(e) => setSolution(e.target.value)}
              rows={2}
              aria-label="Solución propuesta"
              placeholder="Una plataforma web que centralice clientes, agenda y seguimiento."
            />
          </Field>
        </FormSection>

        <FormSection title="Conceptos">
          {/* Cabecera de tabla: solo en pantallas donde las columnas caben. */}
          <div className="hidden items-center gap-2 px-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:flex">
            <span className="min-w-0 flex-1">Concepto</span>
            <span className="w-28">Frecuencia</span>
            <span className="w-14 text-right">Cant.</span>
            <span className="w-24 text-right">Precio</span>
            <span className="w-24 text-right">Importe</span>
            <span className="w-8" />
          </div>

          <div className="divide-y divide-border/50 border-y border-border/50">
            {rows.map((row, index) => {
              const cents = parseMoneyToCents(row.unitPrice);
              const badPrice = row.unitPrice.trim() !== "" && cents === null;
              const item = items[index];
              const filled = row.description.trim() !== "";
              return (
                <div key={index} className="flex flex-wrap items-center gap-2 py-2">
                  <Input
                    value={row.description}
                    onChange={(e) => patch(index, { description: e.target.value })}
                    placeholder="Desarrollo de sitio web"
                    aria-label={`Concepto ${index + 1}`}
                    className={cn(CELL, "w-full min-w-0 sm:w-auto sm:flex-1")}
                  />
                  {/* Frecuencia del concepto (orden de Miguel): un servicio
                      recurrente no se suma al pago único — ver el resumen. */}
                  <select
                    value={row.recurrence}
                    onChange={(e) => patch(index, { recurrence: e.target.value as Recurrence })}
                    aria-label={`Frecuencia del concepto ${index + 1}`}
                    className={cn(
                      "h-9 w-28 rounded-md border border-transparent bg-transparent px-2 text-xs transition-colors",
                      "hover:border-input hover:bg-accent/40 focus-visible:border-input focus-visible:bg-accent/30",
                      "focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none",
                      row.recurrence !== "unica" ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {RECURRENCES.map((r) => (
                      <option key={r} value={r}>
                        {RECURRENCE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                  <Input
                    value={row.quantity}
                    onChange={(e) => patch(index, { quantity: e.target.value })}
                    inputMode="decimal"
                    aria-label={`Cantidad del concepto ${index + 1}`}
                    className={cn(CELL, "w-14 text-right tabular-nums")}
                  />
                  {/* Fuera de foco se lee como dinero («$25,000.00»); al
                      enfocar vuelve a crudo para poder teclear. El valor que se
                      guarda no cambia: `parseMoneyToCents` acepta ambas formas
                      (hay test). */}
                  <Input
                    ref={(el) => {
                      priceRefs.current[index] = el;
                    }}
                    value={
                      priceFocus === index || cents === null ? row.unitPrice : formatAmount(cents, currency)
                    }
                    onChange={(e) => patch(index, { unitPrice: e.target.value })}
                    onFocus={() => setPriceFocus(index)}
                    onBlur={() => setPriceFocus((f) => (f === index ? null : f))}
                    inputMode="decimal"
                    placeholder={formatAmount(0, currency)}
                    aria-label={`Precio unitario del concepto ${index + 1}`}
                    className={cn(CELL, "w-24 text-right tabular-nums", badPrice && "border-destructive")}
                  />
                  {/* §3 y §4: el importe NUNCA se captura, se calcula — y pesa. */}
                  <span
                    className={cn(
                      "w-24 px-2 text-right text-sm tabular-nums",
                      filled && item ? "font-medium text-foreground" : "text-muted-foreground/50",
                    )}
                  >
                    {filled && item ? formatAmount(lineTotalCents(item), currency) : "—"}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-8 shrink-0 px-0 text-muted-foreground hover:text-destructive"
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

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 text-muted-foreground hover:text-foreground"
            onClick={() => setRows((c) => [...c, emptyRow()])}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Agregar concepto
          </Button>
        </FormSection>

        <FormSection title="Condiciones">
          <Field label="Alcance incluido" className={PROSE}>
            <AutoTextarea
              className={PROSE_INPUT}
              value={scopeIncluded}
              onChange={(e) => setScopeIncluded(e.target.value)}
              rows={3}
              aria-label="Alcance incluido"
              placeholder={"Landing page\nPanel administrativo\nAgenda\nCapacitación inicial"}
            />
          </Field>

          {/* §5: tiempo y forma de pago comparten fila en desktop. */}
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
                className={cn(SELECT_CLASS, "w-full")}
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
            <Field label="Condiciones de pago" className={PROSE}>
              <Textarea
                value={paymentCustom}
                onChange={(e) => setPaymentCustom(e.target.value)}
                rows={2}
                aria-label="Condiciones de pago"
                placeholder="Tres pagos: al inicio, a la mitad y contra entrega."
              />
            </Field>
          ) : null}

          {/* §6: las exclusiones estándar existen, pero no se leen cada vez. */}
          <div className="rounded-md border border-border/60">
            <button
              type="button"
              onClick={() => setExclusionsOpen((v) => !v)}
              aria-expanded={exclusionsOpen}
              className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent/40"
            >
              <span className="min-w-0">
                <span className="block text-xs font-medium text-foreground/80">Condiciones estándar de PixelTEC</span>
                <span className="block text-xs text-muted-foreground">
                  {countLines(exclusions)}{" "}
                  {countLines(exclusions) === 1 ? "exclusión incluida" : "exclusiones incluidas"}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                {exclusionsOpen ? "Ocultar" : "Editar"}
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", exclusionsOpen && "rotate-180")} />
              </span>
            </button>
            {exclusionsOpen ? (
              <div className="border-t border-border/60 p-3">
                <Textarea
                  value={exclusions}
                  onChange={(e) => setExclusions(e.target.value)}
                  rows={4}
                  aria-label="Fuera de alcance"
                  className={PROSE}
                />
              </div>
            ) : null}
          </div>

          {/* §7: las notas son opcionales; vacías no ocupan sitio. */}
          {notesOpen ? (
            <Field label="Notas y condiciones adicionales" className={PROSE}>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                aria-label="Notas y condiciones adicionales"
                placeholder="Número de revisiones, tiempos de respuesta, soporte, qué debe entregar el cliente…"
              />
            </Field>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-ml-2 text-muted-foreground hover:text-foreground"
              onClick={() => setNotesOpen(true)}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Agregar notas adicionales
            </Button>
          )}
        </FormSection>
      </div>

      {/* ── Resumen (§8, §9) ───────────────────────────────────────────── */}
      <aside className="lg:sticky lg:top-2 lg:self-start">
        <div className="space-y-4 rounded-xl border border-border bg-card/60 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resumen</h3>

          {breakdown.recurring.length > 0 ? (
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pago único</p>
          ) : null}
          <dl className="space-y-2 text-sm tabular-nums">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="text-foreground">{formatAmount(totals.subtotalCents, currency)}</dd>
            </div>
            {/* El interruptor del IVA vive en la línea que modifica: un solo
                control, y su efecto se ve en el mismo renglón. */}
            <div className="flex items-center justify-between gap-3">
              <dt>
                <label className="flex cursor-pointer items-center gap-2 text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={taxEnabled}
                    onChange={(e) => setTaxEnabled(e.target.checked)}
                    className="h-3.5 w-3.5"
                    aria-label="Agregar IVA (16%)"
                  />
                  IVA 16%
                </label>
              </dt>
              <dd className={taxEnabled ? "text-foreground" : "text-muted-foreground/50"}>
                {formatAmount(totals.taxCents, currency)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 border-t border-border pt-3">
              <dt className="text-sm font-medium text-foreground">
                {breakdown.recurring.length > 0 ? "Total inicial" : "Total"}
              </dt>
              {/* La conclusión comercial de toda la pantalla: pesa más que
                  cualquier otro número, sin recurrir al color. */}
              <dd className="text-2xl font-semibold tracking-tight text-foreground">
                {formatAmount(totals.totalCents, currency)}{" "}
                <span className="text-xs font-normal text-muted-foreground">{currency}</span>
              </dd>
            </div>
          </dl>

          {/* El reparto pertenece al PAGO ÚNICO: un «50% de anticipo» sobre una
              mensualidad no significa nada. Por eso va aquí y no al final. */}
          {schedule.length > 0 ? (
            <dl className="space-y-1.5 pt-1 text-xs tabular-nums">
              {schedule.map((i) => (
                <div key={i.label} className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">
                    {i.percent}% {i.label.toLowerCase()}
                  </dt>
                  <dd className="text-foreground">{formatAmount(i.amountCents, currency)}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          {/* Un bloque por periodicidad. NUNCA se suman al total inicial: son
              unidades distintas y mezclarlas daría un número falso. */}
          {breakdown.recurring.map(({ recurrence, totals: t }) => (
            <div key={recurrence} className="space-y-2 border-t border-border/70 pt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {RECURRENCE_TOTAL_LABEL[recurrence]}
              </p>
              <dl className="space-y-2 text-sm tabular-nums">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">{RECURRENCE_SUBTOTAL_LABEL[recurrence]}</dt>
                  <dd className="text-foreground">{formatAmount(t.subtotalCents, currency)}</dd>
                </div>
                {taxEnabled ? (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">IVA 16%</dt>
                    <dd className="text-foreground">{formatAmount(t.taxCents, currency)}</dd>
                  </div>
                ) : null}
                <div className="flex items-baseline justify-between gap-3 border-t border-border pt-2">
                  <dt className="text-sm font-medium text-foreground">{RECURRENCE_GRAND_LABEL[recurrence]}</dt>
                  <dd className="text-lg font-semibold text-foreground">
                    {formatAmount(t.totalCents, currency)}{" "}
                    <span className="text-xs font-normal text-muted-foreground">{currency}</span>
                  </dd>
                </div>
              </dl>
            </div>
          ))}

          <div className="space-y-2 border-t border-border/70 pt-4">
            <Button type="button" className="w-full" onClick={submit} disabled={saving || issues.length > 0}>
              {saveLabel}
            </Button>
            <Button type="button" variant="ghost" className="w-full text-muted-foreground" onClick={onCancel}>
              Cancelar
            </Button>
            {issues.length > 0 ? (
              <p className="pt-1 text-center text-xs text-muted-foreground">{issues[0].message}</p>
            ) : null}
          </div>
        </div>
      </aside>
    </div>
  );
}
