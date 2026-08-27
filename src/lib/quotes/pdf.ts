import 'server-only';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  FREQUENCY_KEY_LABEL,
  frequencyKeyOf,
  isFirstYearFree,
  RECURRENCE_SUBTOTAL_LABEL,
  RECURRENCE_GRAND_LABEL,
  computeBreakdown,
  lineTotalCents,
} from './money';
import { annualRenewalSummary, formatAmount, paymentSummary } from './terms';
import type { QuoteRecord } from './queries';

const execFileAsync = promisify(execFile);

/**
 * Genera el PDF de una cotización (WO-2026-00101/00102).
 *
 * El armado del documento corre en un proceso de Node aparte — mismo patrón y
 * mismo motivo que propuestas y contratos: dentro del bundler de Next,
 * @react-pdf/renderer revienta con React error #31.
 */
const WORKER_PATH = path.join(process.cwd(), 'src/lib/documents/pdf-render-worker/render-quote.mjs');

/**
 * Tope de tiempo heredado de contratos: el motor de paginación de
 * @react-pdf 3.4.x puede entrar en bucle con ciertas combinaciones. Sin
 * timeout, la petición se queda colgada hasta que el kernel mata el proceso.
 */
const WORKER_TIMEOUT_MS = 30_000;

/** Fecha en el formato que se lee en un documento, no en un log. */
function humanDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/** Cantidad sin decimales cuando es entera: «3», no «3.00». */
function formatQty(quantity: number): string {
  return Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(2);
}

export async function renderQuotePdf({
  quote,
  clientName,
}: {
  quote: QuoteRecord;
  clientName: string;
}): Promise<Buffer> {
  const breakdown = computeBreakdown(quote.items, quote.taxEnabled);
  const totals = breakdown.oneTime;

  // El worker solo recibe TEXTO YA FORMATEADO: la aritmética y el formato de
  // moneda viven en `money.ts`, que está cubierto por tests. El worker no
  // vuelve a calcular nada, así que no puede discrepar del panel ni del correo.
  const payload = {
    folio: quote.folio,
    title: quote.title,
    clientName,
    date: humanDate(quote.createdAt) ?? '',
    validUntil: humanDate(quote.validUntil),
    notes: quote.notes,
    problem: quote.problem,
    solution: quote.solution,
    scopeIncluded: quote.scopeIncluded,
    exclusions: quote.exclusions,
    estimatedDelivery: quote.estimatedDelivery,
    paymentSummary: paymentSummary(totals.totalCents, quote.paymentTerms, quote.currency),
    currency: quote.currency,
    taxEnabled: quote.taxEnabled,
    // «Total inicial» en vez de «Total» en cuanto haya algo que no se cobre
    // hoy: una mensualidad o una renovación anual.
    hasRecurring: breakdown.recurring.length > 0 || breakdown.annualRenewal !== null,
    recurring: breakdown.recurring.map((g) => ({
      subtotalLabel: RECURRENCE_SUBTOTAL_LABEL[g.recurrence],
      grandLabel: RECURRENCE_GRAND_LABEL[g.recurrence],
      subtotal: formatAmount(g.totals.subtotalCents, quote.currency),
      tax: formatAmount(g.totals.taxCents, quote.currency),
      total: `${formatAmount(g.totals.totalCents, quote.currency)} ${quote.currency}`,
    })),
    // La renovación NO es una columna de totales más: es texto, y va después de
    // la forma de pago, igual que en pantalla. Mismo `annualRenewalSummary` que
    // usan el documento y el panel, así que los tres no pueden divergir.
    annualRenewal: breakdown.annualRenewal
      ? annualRenewalSummary(
          breakdown.annualRenewal,
          quote.taxEnabled,
          quote.currency,
          quote.items.some(isFirstYearFree),
        )
      : null,
    items: quote.items.map((item) => ({
      description: item.description,
      recurrence: FREQUENCY_KEY_LABEL[frequencyKeyOf(item)],
      quantity: formatQty(item.quantity),
      unitPrice: formatAmount(item.unitPriceCents, quote.currency),
      // Con primer año gratis el PDF muestra el precio y lo marca: tacharlo no
      // se puede en @react-pdf sin tocar el worker, así que se dice con texto.
      // Solo «Incluido»: el precio ya está en la columna PRECIO, y repetirlo
      // aquí desbordaba los 90 pt de la columna y se montaba encima.
      lineTotal: isFirstYearFree(item) ? 'Incluido' : formatAmount(lineTotalCents(item), quote.currency),
    })),
    subtotal: formatAmount(totals.subtotalCents, quote.currency),
    tax: formatAmount(totals.taxCents, quote.currency),
    total: `${formatAmount(totals.totalCents, quote.currency)} ${quote.currency}`,
  };

  const dir = await mkdtemp(path.join(tmpdir(), 'quote-pdf-'));
  const inputPath = path.join(dir, 'quote.json');
  const outputPath = path.join(dir, 'quote.pdf');
  try {
    await writeFile(inputPath, JSON.stringify(payload), 'utf-8');
    await execFileAsync('node', [WORKER_PATH, inputPath, outputPath], {
      timeout: WORKER_TIMEOUT_MS,
    });
    return await readFile(outputPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
