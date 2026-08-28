import { describe, it, expect, vi } from 'vitest';

/**
 * Mock `server-only` before importing provision.ts so it doesn't throw in Node
 * test environment. The real guard is enforced at build/deploy time by Next.js.
 */
const { serverOnlyMock } = vi.hoisted(() => ({
  serverOnlyMock: vi.fn(),
}));
vi.mock('server-only', () => ({}));

import { buildProjectDraft, centsToAmount, monthlyStartDate } from './provision';

describe('centavos → numeric(12,2)', () => {
  it('convierte sin redondeos raros', () => {
    expect(centsToAmount(3000000)).toBe('30000.00');
    expect(centsToAmount(0)).toBe('0.00');
    expect(centsToAmount(150050)).toBe('1500.50');
  });
});

describe('buildProjectDraft', () => {
  const sale = { clientId: 'client-1', title: 'Sistema de reservaciones', oneTimeTotalCents: 3000000 };

  it('toma el nombre y el presupuesto de la venta', () => {
    const draft = buildProjectDraft(sale, []);
    expect(draft).toEqual({ clientId: 'client-1', name: 'Sistema de reservaciones', budget: '30000.00', annual: '0.00' });
  });

  it('toma el anual del recurrente de frecuencia annual, si existe', () => {
    const recurring = [
      { frequency: 'monthly' as const, amount: '100.00' },
      { frequency: 'annual' as const, amount: '899.00' },
    ];
    const draft = buildProjectDraft(sale, recurring);
    expect(draft.annual).toBe('899.00');
  });

  it('sin recurrente anual, annual queda en 0.00', () => {
    const recurring = [{ frequency: 'monthly' as const, amount: '100.00' }];
    expect(buildProjectDraft(sale, recurring).annual).toBe('0.00');
  });
});

describe('monthlyStartDate', () => {
  it('formatea la fecha LOCAL, no UTC', () => {
    // 2026-08-27 20:00 hora de México — con toISOString() puro caería al 28.
    const now = new Date(2026, 7, 27, 20, 0, 0);
    expect(monthlyStartDate(now)).toBe('2026-08-27');
  });

  it('rellena con ceros mes y día de un dígito', () => {
    const now = new Date(2026, 0, 5, 10, 0, 0);
    expect(monthlyStartDate(now)).toBe('2026-01-05');
  });
});
