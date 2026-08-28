import { describe, it, expect } from 'vitest';
import { isChargeDue, buildMaterializedBillingItem } from './recurring-scheduler';

describe('isChargeDue', () => {
  it('todavía no vence si la fecha es futura', () => {
    expect(isChargeDue(new Date(2027, 7, 27), new Date(2027, 7, 26))).toBe(false);
  });

  it('vence exactamente el día', () => {
    expect(isChargeDue(new Date(2027, 7, 27), new Date(2027, 7, 27))).toBe(true);
  });

  it('sigue vencido si ya pasó', () => {
    expect(isChargeDue(new Date(2027, 7, 27), new Date(2027, 7, 30))).toBe(true);
  });
});

describe('buildMaterializedBillingItem', () => {
  const charge = {
    id: 'rec-1',
    saleId: 'sale-1',
    clientId: 'client-1',
    projectId: 'project-1',
    concept: 'Renovación anual COT-2026-0017',
    amount: '1042.84',
    frequency: 'annual' as const,
  };

  it('copia los datos del recurrente al borrador del cobro', () => {
    const draft = buildMaterializedBillingItem(charge, new Date(2027, 7, 27), 'MXN');
    expect(draft).toEqual({
      clientId: 'client-1',
      saleId: 'sale-1',
      projectId: 'project-1',
      recurringChargeId: 'rec-1',
      concept: 'Renovación anual COT-2026-0017',
      amount: '1042.84',
      currency: 'MXN',
      frequency: 'anual',
      status: 'pendiente',
      dueDate: '2027-08-27',
    });
  });

  it('traduce mensual → mensual (billing_frequency, no charge_frequency)', () => {
    const draft = buildMaterializedBillingItem({ ...charge, frequency: 'monthly' }, new Date(2026, 8, 27), 'MXN');
    expect(draft.frequency).toBe('mensual');
  });

  it('sin clientId truena — no se puede materializar un cobro sin cliente', () => {
    expect(() => buildMaterializedBillingItem({ ...charge, clientId: null }, new Date(2027, 7, 27), 'MXN')).toThrow(
      /sin clientId/,
    );
  });
});
