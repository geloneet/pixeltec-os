import { describe, it, expect } from 'vitest';
import {
  isCurrency,
  formatAmount,
  formatAmountWithCode,
  displayStatus,
  defaultValidUntil,
  firstFollowUp,
  nextFollowUp,
  followUpLabel,
  needsFollowUp,
  formatDate,
  formatShortDate,
  paymentSchedule,
  paymentSummary,
  firstInstalment,
  parsePaymentTerms,
  missingToSend,
  DEFAULT_EXCLUSIONS,
  DEFAULT_PAYMENT_TERMS,
  type PaymentTerms,
} from './terms';
import type { QuoteItem } from './money';

/** WO-2026-00104 — MVP comercial. Fuente única de estados, fechas y pagos. */

const item = (description: string, quantity: number, unitPriceCents: number): QuoteItem => ({
  description,
  quantity,
  unitPriceCents,
});

// Fecha fija: los tests no dependen del reloj de la máquina.
const NOW = new Date('2026-08-26T12:00:00-06:00');

describe('moneda (§4)', () => {
  it('acepta MXN y USD, y nada más', () => {
    expect(isCurrency('MXN')).toBe(true);
    expect(isCurrency('USD')).toBe(true);
    expect(isCurrency('EUR')).toBe(false);
  });

  it('formatea sin convertir divisas', () => {
    expect(formatAmount(3480000, 'MXN')).toContain('34,800.00');
    expect(formatAmountWithCode(3480000, 'USD')).toContain('USD');
    // Mismo número de centavos ⇒ mismo importe: no hay conversión.
    expect(formatAmount(3480000, 'USD')).toContain('34,800.00');
  });
});

describe('estados (§14)', () => {
  it('un borrador nunca se muestra vencido, aunque la fecha haya pasado', () => {
    expect(displayStatus('borrador', '2026-01-01T00:00:00Z', NOW)).toBe('borrador');
  });

  it('una enviada con la vigencia pasada se muestra vencida', () => {
    expect(displayStatus('enviada', '2026-08-01T00:00:00Z', NOW)).toBe('vencida');
  });

  it('una enviada dentro de vigencia sigue enviada', () => {
    expect(displayStatus('enviada', '2026-09-30T00:00:00Z', NOW)).toBe('enviada');
  });

  it('aceptada y rechazada NO caducan por que pase la fecha', () => {
    expect(displayStatus('aceptada', '2026-01-01T00:00:00Z', NOW)).toBe('aceptada');
    expect(displayStatus('rechazada', '2026-01-01T00:00:00Z', NOW)).toBe('rechazada');
  });

  it('un estado desconocido en la base cae a borrador, no rompe la pantalla', () => {
    expect(displayStatus('lo-que-sea', null, NOW)).toBe('borrador');
  });
});

describe('vigencia y seguimiento (§6, §20)', () => {
  it('la vigencia por defecto es hoy + 15 días', () => {
    const v = defaultValidUntil(NOW);
    expect(Math.round((v.getTime() - NOW.getTime()) / 86_400_000)).toBe(15);
  });

  it('el primer seguimiento es +3 días y el siguiente +7', () => {
    expect(Math.round((firstFollowUp(NOW).getTime() - NOW.getTime()) / 86_400_000)).toBe(3);
    expect(Math.round((nextFollowUp(NOW).getTime() - NOW.getTime()) / 86_400_000)).toBe(7);
  });

  it('la columna Seguimiento dice «Hoy», la fecha, o que está pendiente', () => {
    expect(followUpLabel('2026-08-26T09:00:00-06:00', 'enviada', NOW)).toBe('Hoy');
    expect(followUpLabel('2026-08-29T09:00:00-06:00', 'enviada', NOW)).toBe(formatShortDate('2026-08-29T09:00:00-06:00'));
    expect(followUpLabel('2026-08-20T09:00:00-06:00', 'enviada', NOW)).toBe('Seguimiento pendiente');
  });

  it('solo las enviadas piden seguimiento', () => {
    for (const status of ['borrador', 'aceptada', 'rechazada', 'vencida'] as const) {
      expect(followUpLabel('2026-08-20T09:00:00-06:00', status, NOW)).toBeNull();
    }
    expect(needsFollowUp('2026-08-20T09:00:00-06:00', 'aceptada', NOW)).toBe(false);
    expect(needsFollowUp('2026-08-20T09:00:00-06:00', 'enviada', NOW)).toBe(true);
  });

  it('las fechas se muestran legibles', () => {
    expect(formatDate('2026-09-10T12:00:00Z')).toContain('septiembre');
    expect(formatDate('no es fecha')).toBeNull();
    expect(formatDate(null)).toBeNull();
  });
});

describe('forma de pago (§12)', () => {
  const t = (type: PaymentTerms['type'], custom = ''): PaymentTerms => ({ type, custom });

  it('50/50 parte el total en dos mitades', () => {
    const s = paymentSchedule(2000000, t('50_50'));
    expect(s.map((i) => i.amountCents)).toEqual([1000000, 1000000]);
    expect(s[0].label).toBe('Anticipo');
  });

  it('40/30/30 reparte en tres', () => {
    expect(paymentSchedule(3480000, t('40_30_30')).map((i) => i.amountCents)).toEqual([1392000, 1044000, 1044000]);
  });

  it('las parcialidades SIEMPRE suman exactamente el total', () => {
    // Totales elegidos para que los porcentajes no den centavos exactos.
    for (const total of [3480001, 999, 100003, 7, 1]) {
      for (const type of ['50_50', '40_30_30'] as const) {
        const sum = paymentSchedule(total, t(type)).reduce((s, i) => s + i.amountCents, 0);
        expect(sum, `${type} sobre ${total}`).toBe(total);
      }
    }
  });

  it('mensual y personalizada no tienen reparto', () => {
    expect(paymentSchedule(2000000, t('mensual'))).toEqual([]);
    expect(paymentSchedule(2000000, t('personalizada'))).toEqual([]);
  });

  it('el resumen se lee como se lee en un PDF', () => {
    const text = paymentSummary(2000000, t('50_50'), 'MXN');
    expect(text).toContain('Anticipo 50%');
    expect(text).toContain('10,000.00');
    expect(text).toContain('MXN');
  });

  it('personalizada muestra lo que escribió Miguel', () => {
    expect(paymentSummary(2000000, t('personalizada', 'Tres pagos a convenir'), 'MXN')).toBe('Tres pagos a convenir');
  });

  it('el cobro propuesto es la primera parcialidad', () => {
    expect(firstInstalment(2000000, t('50_50'))?.amountCents).toBe(1000000);
    expect(firstInstalment(3480000, t('40_30_30'))?.amountCents).toBe(1392000);
  });

  it('sin reparto conocido se propone el total, no cero', () => {
    expect(firstInstalment(2000000, t('mensual'))?.amountCents).toBe(2000000);
    expect(firstInstalment(2000000, t('personalizada'))?.amountCents).toBe(2000000);
  });

  it('lee la forma de pago guardada y sobrevive a basura', () => {
    expect(parsePaymentTerms({ type: '40_30_30', custom: '' }).type).toBe('40_30_30');
    for (const bad of [null, undefined, 'texto', { type: 'inventada' }, {}]) {
      expect(parsePaymentTerms(bad)).toEqual(DEFAULT_PAYMENT_TERMS);
    }
  });
});

describe('validación por intención (§29)', () => {
  const complete = {
    title: 'Sistema de citas',
    items: [item('Plataforma', 1, 2500000)],
    validUntil: '2026-09-10T00:00:00Z',
    problem: 'Citas por WhatsApp y Excel.',
    solution: 'Plataforma web centralizada.',
    scopeIncluded: 'Landing, panel, agenda.',
    paymentTerms: DEFAULT_PAYMENT_TERMS,
  };

  it('una cotización completa se puede enviar', () => {
    expect(missingToSend(complete)).toEqual([]);
  });

  it('nombra exactamente lo que falta', () => {
    expect(missingToSend({ ...complete, problem: '  ' })).toEqual(['el problema a resolver']);
    expect(missingToSend({ ...complete, solution: '' })).toEqual(['la solución propuesta']);
    expect(missingToSend({ ...complete, scopeIncluded: '' })).toEqual(['el alcance incluido']);
    expect(missingToSend({ ...complete, validUntil: null })).toEqual(['la vigencia']);
  });

  it('un total de cero no se envía a un cliente', () => {
    expect(missingToSend({ ...complete, items: [item('Cortesía', 1, 0)] })).toContain('un total mayor que cero');
  });

  it('la forma personalizada exige escribir las condiciones', () => {
    expect(missingToSend({ ...complete, paymentTerms: { type: 'personalizada', custom: '' } })).toContain(
      'las condiciones de pago',
    );
  });
});

describe('exclusiones por defecto (§10)', () => {
  it('trae las tres estándar, en líneas separadas', () => {
    expect(DEFAULT_EXCLUSIONS.split('\n')).toHaveLength(3);
    expect(DEFAULT_EXCLUSIONS).toContain('se cotizan por separado');
  });
});
