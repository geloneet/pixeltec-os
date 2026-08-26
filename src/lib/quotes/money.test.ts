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
    expect(computeTotals([], true)).toEqual({ subtotalCents: 0, taxCents: 0, totalCents: 0 });
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
  const ok = { title: 'Sitio web', items: [item('Landing', 1, 1500000)], validUntil: null };

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
    const fields = validateQuote({ ...ok, items: [item('Landing', 0, -100)] }).map((i) => i.field);
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
    expect(validateQuote({ ...ok, items: [item('Landing', 1, 100), item('', 0, 0)] })).toEqual([]);
  });
});

describe('limpieza de conceptos', () => {
  it('descarta las filas en blanco y recorta espacios', () => {
    const out = usableItems([item('  Landing  ', 1, 100), item('   ', 1, 0)]);
    expect(out).toHaveLength(1);
    expect(out[0].description).toBe('Landing');
  });
});
