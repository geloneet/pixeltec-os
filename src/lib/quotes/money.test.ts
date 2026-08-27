import { describe, it, expect } from 'vitest';
import {
  IVA_RATE,
  lineTotalCents,
  computeTotals,
  formatMoney,
  parseMoneyToCents,
  centsToInput,
  validateQuote,
  usableItems,
  RECURRENCES,
  recurrenceOf,
  computeBreakdown,
  hasRecurring,
  chargeableLineTotalCents,
  isFirstYearFree,
  frequencyKeyOf,
  applyFrequencyKey,
  FREQUENCY_KEYS,
  type QuoteItem,
} from './money';

/** WO-2026-00101 — aritmética de cotizaciones. Aquí un error cuesta dinero. */

const item = (description: string, quantity: number, unitPriceCents: number): QuoteItem => ({
  description,
  quantity,
  unitPriceCents,
});

describe('importe por línea', () => {
  it('multiplica cantidad por precio unitario', () => {
    expect(lineTotalCents(item('Landing', 1, 1500000))).toBe(1500000);
    expect(lineTotalCents(item('Horas', 8, 65000))).toBe(520000);
  });

  it('admite cantidades decimales', () => {
    expect(lineTotalCents(item('Horas', 2.5, 60000))).toBe(150000);
  });

  it('redondea a centavo entero, nunca deja fracciones', () => {
    const total = lineTotalCents(item('Prorrateo', 3, 33333));
    expect(Number.isInteger(total)).toBe(true);
    expect(total).toBe(99999);
  });
});

describe('totales', () => {
  it('suma el subtotal sin arrastrar errores de flotante', () => {
    // El caso clásico: 0.10 + 0.20 en pesos.
    const { subtotalCents } = computeTotals([item('a', 1, 10), item('b', 1, 20)], false);
    expect(subtotalCents).toBe(30);
  });

  it('aplica IVA del 16 % cuando está activado', () => {
    const t = computeTotals([item('Servicio', 1, 100000)], true);
    expect(IVA_RATE).toBe(16);
    expect(t.subtotalCents).toBe(100000);
    expect(t.taxCents).toBe(16000);
    expect(t.totalCents).toBe(116000);
  });

  it('sin IVA, el total es el subtotal', () => {
    const t = computeTotals([item('Servicio', 1, 100000)], false);
    expect(t.taxCents).toBe(0);
    expect(t.totalCents).toBe(t.subtotalCents);
  });

  it('el IVA sale del subtotal, no de la suma de IVAs por línea', () => {
    // Tres líneas cuyo IVA individual redondea distinto que el del subtotal.
    const items = [item('a', 1, 333), item('b', 1, 333), item('c', 1, 333)];
    const t = computeTotals(items, true);
    const perLine = items.reduce((s, i) => s + Math.round((lineTotalCents(i) * 16) / 100), 0);
    expect(t.subtotalCents).toBe(999);
    expect(t.taxCents).toBe(160); // 999 * 0.16 = 159.84 → 160
    expect(perLine).toBe(159); // 53 * 3 — distinto: por eso se calcula sobre el subtotal
    expect(t.totalCents).toBe(1159);
  });

  it('una cotización vacía suma cero', () => {
    expect(computeTotals([], true)).toEqual({
      subtotalCents: 0,
      taxCents: 0,
      totalCents: 0,
    });
  });

  it('todos los importes son enteros', () => {
    const t = computeTotals([item('a', 3, 33333), item('b', 1.5, 12345)], true);
    for (const v of Object.values(t)) expect(Number.isInteger(v)).toBe(true);
  });
});

describe('lectura de precios escritos a mano', () => {
  it('acepta las formas que la gente escribe de verdad', () => {
    expect(parseMoneyToCents('1234.50')).toBe(123450);
    expect(parseMoneyToCents('1,234.50')).toBe(123450);
    expect(parseMoneyToCents('$1,234.50')).toBe(123450);
    expect(parseMoneyToCents(' 1234 ')).toBe(123400);
    expect(parseMoneyToCents('.5')).toBe(50);
  });

  it('un precio que no se entiende NO se convierte en cero', () => {
    for (const bad of ['', 'abc', '12.34.56', '1e5', '--3']) {
      expect(parseMoneyToCents(bad), `«${bad}» debería ser null`).toBeNull();
    }
  });

  it('ida y vuelta entre input y centavos', () => {
    expect(centsToInput(123450)).toBe('1234.50');
    expect(parseMoneyToCents(centsToInput(99999))).toBe(99999);
  });
});

describe('formato en pantalla', () => {
  it('muestra pesos mexicanos con dos decimales', () => {
    const out = formatMoney(123456);
    expect(out).toContain('1,234.56');
    expect(out).toContain('$');
  });

  it('el cero se muestra, no se oculta', () => {
    expect(formatMoney(0)).toContain('0.00');
  });
});

describe('validación', () => {
  const ok = {
    title: 'Sitio web',
    items: [item('Landing', 1, 1500000)],
    validUntil: null,
  };

  it('una cotización completa no tiene problemas', () => {
    expect(validateQuote(ok)).toEqual([]);
  });

  it('exige título', () => {
    expect(validateQuote({ ...ok, title: '  ' }).map((i) => i.field)).toContain('title');
  });

  it('exige al menos un concepto con descripción', () => {
    expect(validateQuote({ ...ok, items: [item('  ', 1, 100)] }).map((i) => i.field)).toContain('items');
  });

  it('rechaza cantidad cero o negativa y precio negativo', () => {
    const fields = validateQuote({
      ...ok,
      items: [item('Landing', 0, -100)],
    }).map((i) => i.field);
    expect(fields).toContain('items.0.quantity');
    expect(fields).toContain('items.0.unitPriceCents');
  });

  it('un precio de cero es válido: hay conceptos sin costo', () => {
    expect(validateQuote({ ...ok, items: [item('Cortesía', 1, 0)] })).toEqual([]);
  });

  it('rechaza una vigencia que no es fecha', () => {
    expect(validateQuote({ ...ok, validUntil: 'mañana' }).map((i) => i.field)).toContain('validUntil');
  });

  it('no se queja de las filas en blanco que deja el formulario', () => {
    expect(
      validateQuote({
        ...ok,
        items: [item('Landing', 1, 100), item('', 0, 0)],
      }),
    ).toEqual([]);
  });
});

describe('limpieza de conceptos', () => {
  it('descarta las filas en blanco y recorta espacios', () => {
    const out = usableItems([item('  Landing  ', 1, 100), item('   ', 1, 0)]);
    expect(out).toHaveLength(1);
    expect(out[0].description).toBe('Landing');
  });
});

/**
 * Recurrencia por concepto (orden de Miguel 2026-08-26). La regla que protegen
 * estos tests: un mensual NUNCA se suma a un pago único.
 */
describe('periodicidad por concepto', () => {
  const rec = (description: string, unitPriceCents: number, recurrence?: QuoteItem['recurrence']): QuoteItem => ({
    description,
    quantity: 1,
    unitPriceCents,
    recurrence,
  });

  it('un concepto sin periodicidad es de pago único (compatibilidad)', () => {
    expect(recurrenceOf({})).toBe('unica');
    expect(recurrenceOf({ recurrence: 'inventada' })).toBe('unica');
    expect(recurrenceOf({ recurrence: 'mensual' })).toBe('mensual');
  });

  it('las cotizaciones antiguas, sin el campo, siguen dando el mismo total', () => {
    const antiguas = [rec('Desarrollo', 2500000), rec('Configuración', 500000)];
    const b = computeBreakdown(antiguas, true);
    expect(b.oneTime.totalCents).toBe(computeTotals(antiguas, true).totalCents);
    expect(b.recurring).toEqual([]);
  });

  it('NO suma el mensual dentro del pago único', () => {
    const b = computeBreakdown([rec('Desarrollo', 2500000), rec('Hospedaje', 50000, 'mensual')], false);
    expect(b.oneTime.totalCents).toBe(2500000);
    expect(b.recurring).toHaveLength(1);
    expect(b.recurring[0]).toEqual({
      recurrence: 'mensual',
      totals: { subtotalCents: 50000, taxCents: 0, totalCents: 50000 },
    });
  });

  it('agrupa varios conceptos de la misma frecuencia', () => {
    const b = computeBreakdown([rec('Hospedaje', 90000, 'mensual'), rec('Mantenimiento', 250000, 'mensual')], false);
    expect(b.oneTime.totalCents).toBe(0);
    expect(b.recurring.map((r) => [r.recurrence, r.totals.totalCents])).toEqual([['mensual', 340000]]);
  });

  it('las frecuencias son única vez, mensual y anual', () => {
    expect([...RECURRENCES]).toEqual(['unica', 'mensual', 'anual']);
    // Trimestral quedó fuera a propósito: cae a pago único, no rompe nada.
    expect(recurrenceOf({ recurrence: 'trimestral' })).toBe('unica');
    expect(recurrenceOf({ recurrence: 'anual' })).toBe('anual');
  });

  /**
   * CAMBIO DE REGLA (Miguel, 2026-08-27). Hasta hoy la anual vivía en su propio
   * bloque y NO entraba en el total inicial. Ahora sí: su primera anualidad se
   * cobra al firmar. La mensual sigue fuera — eso no cambió.
   */
  it('la anual SÍ entra al total inicial; la mensual sigue fuera', () => {
    const b = computeBreakdown(
      [rec('Desarrollo', 2000000), rec('Hosting', 90000, 'mensual'), rec('Dominio y SSL', 120000, 'anual')],
      true,
    );
    // 20,000 + 1,200 = 21,200 + IVA 3,392 = 24,592
    expect(b.oneTime).toEqual({
      subtotalCents: 2120000,
      taxCents: 339200,
      totalCents: 2459200,
    });
    expect(b.recurring.map((r) => [r.recurrence, r.totals.totalCents])).toEqual([
      ['mensual', 104400], // 900 + IVA
    ]);
    // Y queda declarado lo que se renovará cada aniversario.
    expect(b.annualRenewal).toEqual({
      subtotalCents: 120000,
      taxCents: 19200,
      totalCents: 139200,
    });
  });

  it('sin conceptos anuales no hay renovación que declarar', () => {
    const b = computeBreakdown([rec('Desarrollo', 2000000), rec('Hosting', 90000, 'mensual')], true);
    expect(b.annualRenewal).toBeNull();
  });

  it('aplica el IVA dentro de cada periodicidad, no al conjunto', () => {
    const b = computeBreakdown([rec('Desarrollo', 100000), rec('Hospedaje', 50000, 'mensual')], true);
    expect(b.oneTime).toEqual({
      subtotalCents: 100000,
      taxCents: 16000,
      totalCents: 116000,
    });
    expect(b.recurring[0].totals).toEqual({
      subtotalCents: 50000,
      taxCents: 8000,
      totalCents: 58000,
    });
  });

  it('el ejemplo real de Miguel: desarrollo único + dos mensuales', () => {
    const b = computeBreakdown(
      [
        rec('Desarrollo del sitio', 2000000),
        rec('Hosting administrado', 90000, 'mensual'),
        rec('Mantenimiento', 250000, 'mensual'),
      ],
      true,
    );
    // Pago único: 20,000 + IVA 3,200 = 23,200
    expect(b.oneTime).toEqual({
      subtotalCents: 2000000,
      taxCents: 320000,
      totalCents: 2320000,
    });
    // Mensual: 3,400 + IVA 544 = 3,944
    expect(b.recurring).toHaveLength(1);
    expect(b.recurring[0].totals).toEqual({
      subtotalCents: 340000,
      taxCents: 54400,
      totalCents: 394400,
    });
    // Y sobre todo: NUNCA aparece 23,400 ni la suma de ambos.
    expect(b.oneTime.totalCents + b.recurring[0].totals.totalCents).not.toBe(2340000);
  });

  it('las filas en blanco no crean grupos fantasma', () => {
    const b = computeBreakdown([rec('Desarrollo', 2500000), rec('   ', 0, 'mensual')], false);
    expect(b.recurring).toEqual([]);
  });

  it('sabe si la cotización lleva algo recurrente', () => {
    expect(hasRecurring([rec('Desarrollo', 100)])).toBe(false);
    expect(hasRecurring([rec('Hospedaje', 100, 'mensual')])).toBe(true);
    expect(hasRecurring([rec('  ', 100, 'mensual')])).toBe(false);
  });
});

/**
 * Regresión (2026-08-26): la frecuencia se guardaba correctamente en el jsonb
 * pero el saneador de lectura no la copiaba, así que al reabrir la cotización
 * un concepto mensual volvía como pago único y el documento sumaba de más.
 * Este test protege el contrato de ida y vuelta del jsonb.
 */
describe('ida y vuelta de la frecuencia por el jsonb', () => {
  it('sobrevive a serializar y volver a leer', () => {
    const original: QuoteItem[] = [
      {
        description: 'Desarrollo del sitio',
        quantity: 1,
        unitPriceCents: 2000000,
        recurrence: 'unica',
      },
      {
        description: 'Hosting administrado',
        quantity: 1,
        unitPriceCents: 90000,
        recurrence: 'mensual',
      },
    ];
    const leidos = (JSON.parse(JSON.stringify(original)) as QuoteItem[]).map((i) => ({
      ...i,
      recurrence: recurrenceOf(i),
    }));
    expect(computeBreakdown(leidos, true)).toEqual(computeBreakdown(original, true));
    expect(leidos[1].recurrence).toBe('mensual');
  });
});

/**
 * «Anual · primer año gratis» (Miguel, 2026-08-27).
 *
 * El caso literal que pidió: se captura el precio de 899, el total inicial no
 * lo incluye, y el sistema conserva el importe porque es lo que se cobrará cada
 * aniversario. Gratis es el PRIMER AÑO, no la renovación.
 */
describe('anual con el primer año incluido', () => {
  const rec = (description: string, unitPriceCents: number, recurrence?: QuoteItem['recurrence']): QuoteItem => ({
    description,
    quantity: 1,
    unitPriceCents,
    recurrence,
  });

  const anualGratis = (description: string, cents: number): QuoteItem => ({
    description,
    quantity: 1,
    unitPriceCents: cents,
    recurrence: 'anual',
    firstYearFree: true,
  });

  it('la bandera solo tiene sentido en un anual', () => {
    expect(isFirstYearFree({ recurrence: 'anual', firstYearFree: true })).toBe(true);
    expect(isFirstYearFree({ recurrence: 'mensual', firstYearFree: true })).toBe(false);
    expect(isFirstYearFree({ recurrence: 'unica', firstYearFree: true })).toBe(false);
    expect(isFirstYearFree({ recurrence: 'anual' })).toBe(false);
  });

  it('la línea conserva su precio pero aporta cero a lo cobrable', () => {
    const item = anualGratis('Hospedaje', 89900);
    expect(lineTotalCents(item)).toBe(89900);
    expect(chargeableLineTotalCents(item)).toBe(0);
  });

  it('los 899 salen del total inicial y reaparecen en la renovación', () => {
    const b = computeBreakdown([rec('Desarrollo', 2500000), anualGratis('Hospedaje', 89900)], true);
    // 25,000 + IVA 4,000 = 29,000. Los 899 NO están.
    expect(b.oneTime).toEqual({
      subtotalCents: 2500000,
      taxCents: 400000,
      totalCents: 2900000,
    });
    // Pero sí se declara lo que se pagará cada aniversario: 899 + IVA.
    expect(b.annualRenewal).toEqual({
      subtotalCents: 89900,
      taxCents: 14384,
      totalCents: 104284,
    });
  });

  it('gratis y cobrada conviven: solo la cobrada suma al total inicial', () => {
    const b = computeBreakdown(
      [rec('Desarrollo', 2500000), anualGratis('Hospedaje', 89900), rec('Dominio', 50000, 'anual')],
      false,
    );
    expect(b.oneTime.totalCents).toBe(2550000); // 25,000 + 500, sin los 899
    expect(b.annualRenewal!.totalCents).toBe(139900); // 899 + 500: las dos renuevan
  });

  it('el desplegable tiene cuatro opciones y va y vuelve sin perder nada', () => {
    expect([...FREQUENCY_KEYS]).toEqual(['unica', 'mensual', 'anual', 'anual_primer_anio_gratis']);
    const item: QuoteItem = {
      description: 'Hospedaje',
      quantity: 1,
      unitPriceCents: 89900,
    };
    const gratis = applyFrequencyKey(item, 'anual_primer_anio_gratis');
    expect(gratis.recurrence).toBe('anual');
    expect(gratis.firstYearFree).toBe(true);
    expect(frequencyKeyOf(gratis)).toBe('anual_primer_anio_gratis');
  });

  it('cambiar de frecuencia limpia la bandera, no la deja colgada', () => {
    const gratis = applyFrequencyKey({ recurrence: 'anual' as const, firstYearFree: true }, 'mensual');
    expect(gratis.firstYearFree).toBe(false);
    expect(frequencyKeyOf(gratis)).toBe('mensual');
  });
});
