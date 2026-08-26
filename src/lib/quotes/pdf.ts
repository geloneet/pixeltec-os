import 'server-only';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { computeTotals, formatMoney, lineTotalCents } from './money';
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
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
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
  const totals = computeTotals(quote.items, quote.taxEnabled);

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
    taxEnabled: quote.taxEnabled,
    items: quote.items.map((item) => ({
      description: item.description,
      quantity: formatQty(item.quantity),
      unitPrice: formatMoney(item.unitPriceCents),
      lineTotal: formatMoney(lineTotalCents(item)),
    })),
    subtotal: formatMoney(totals.subtotalCents),
    tax: formatMoney(totals.taxCents),
    total: formatMoney(totals.totalCents),
  };

  const dir = await mkdtemp(path.join(tmpdir(), 'quote-pdf-'));
  const inputPath = path.join(dir, 'quote.json');
  const outputPath = path.join(dir, 'quote.pdf');
  try {
    await writeFile(inputPath, JSON.stringify(payload), 'utf-8');
    await execFileAsync('node', [WORKER_PATH, inputPath, outputPath], { timeout: WORKER_TIMEOUT_MS });
    return await readFile(outputPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
