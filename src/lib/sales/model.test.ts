import { describe, it, expect } from 'vitest';
import {
  buildSaleFolio,
  parseSaleFolio,
  nextSaleFolio,
  deriveSaleStatus,
  readyForProject,
  isSaleStatus,
  isRecurringStatus,
  type ChargeState,
  firstAnniversary,
} from './model';

/** WO-2026-00106 — la Venta. El estado se DERIVA de los cobros, no se declara. */

const charge = (concept: string, status: string, isDeposit = false): ChargeState => ({
  concept,
  status,
  isDeposit,
});

describe('folio de venta', () => {
  it('sigue el formato VTA-año-consecutivo', () => {
    expect(buildSaleFolio(2026, 1)).toBe('VTA-2026-0001');
    expect(parseSaleFolio('VTA-2026-0042')).toEqual({
      year: 2026,
      sequence: 42,
    });
  });

  it('el consecutivo avanza y reinicia cada año', () => {
    expect(nextSaleFolio(2026, ['VTA-2026-0001', 'VTA-2026-0003'])).toBe('VTA-2026-0004');
    expect(nextSaleFolio(2027, ['VTA-2026-0099'])).toBe('VTA-2027-0001');
    expect(nextSaleFolio(2026, [])).toBe('VTA-2026-0001');
  });

  it('un folio ilegible heredado no bloquea el siguiente', () => {
    expect(nextSaleFolio(2026, ['basura', 'VTA-2026-0007'])).toBe('VTA-2026-0008');
  });
});

describe('el gate del anticipo (§7, §12)', () => {
  it('sin el anticipo cubierto, la venta espera', () => {
    const s = deriveSaleStatus('pendiente_anticipo', [
      charge('Anticipo COT-1', 'pendiente', true),
      charge('Contra entrega COT-1', 'pendiente'),
    ]);
    expect(s).toBe('pendiente_anticipo');
    expect(readyForProject(s)).toBe(false);
  });

  it('con el anticipo pagado, la venta se activa y el proyecto puede empezar', () => {
    const s = deriveSaleStatus('pendiente_anticipo', [
      charge('Anticipo COT-1', 'pagado', true),
      charge('Contra entrega COT-1', 'pendiente'),
    ]);
    expect(s).toBe('activa');
    expect(readyForProject(s)).toBe(true);
  });

  it('un pago PARCIAL del anticipo no abre el gate', () => {
    // `billing_status` tiene «parcial»: medio anticipo no es un anticipo.
    const s = deriveSaleStatus('pendiente_anticipo', [charge('Anticipo COT-1', 'parcial', true)]);
    expect(s).toBe('pendiente_anticipo');
  });

  it('con todos los cobros cubiertos, la venta queda completada', () => {
    expect(deriveSaleStatus('activa', [charge('Anticipo', 'pagado', true), charge('Contra entrega', 'pagado')])).toBe(
      'completada',
    );
  });

  it('los cobros cancelados no cuentan para decidir', () => {
    expect(
      deriveSaleStatus('pendiente_anticipo', [
        charge('Anticipo', 'pagado', true),
        charge('Contra entrega', 'cancelado'),
      ]),
    ).toBe('completada');
  });

  it('una venta cancelada NO se recalcula: esa decisión es humana', () => {
    expect(deriveSaleStatus('cancelada', [charge('Anticipo', 'pagado', true)])).toBe('cancelada');
  });

  it('sin cobros vivos, el estado no se inventa', () => {
    expect(deriveSaleStatus('pendiente_anticipo', [])).toBe('pendiente_anticipo');
    expect(deriveSaleStatus('pendiente_anticipo', [charge('X', 'cancelado')])).toBe('pendiente_anticipo');
  });

  it('sin anticipo marcado, manda el primer cobro', () => {
    expect(deriveSaleStatus('pendiente_anticipo', [charge('Único', 'pagado'), charge('Otro', 'pendiente')])).toBe(
      'activa',
    );
  });

  it('un cobro vencido no cuenta como cubierto', () => {
    expect(deriveSaleStatus('pendiente_anticipo', [charge('Anticipo', 'vencido', true)])).toBe('pendiente_anticipo');
  });
});

describe('vocabulario', () => {
  it('los estados de venta y de recurrente son los aprobados, ni uno más', () => {
    for (const s of ['pendiente_anticipo', 'activa', 'completada', 'cancelada']) {
      expect(isSaleStatus(s)).toBe(true);
    }
    expect(isSaleStatus('inventado')).toBe(false);

    for (const s of ['pending_start', 'active', 'paused', 'cancelled']) {
      expect(isRecurringStatus(s)).toBe(true);
    }
    expect(isRecurringStatus('inventado')).toBe(false);
  });
});

describe('aniversario de la anualidad', () => {
  it('es el mismo día del año siguiente', () => {
    expect(firstAnniversary(new Date(2026, 7, 27, 10, 0))).toBe('2027-08-27');
  });

  it('una aceptación de noche no corre el día (fecha de negocio, no UTC)', () => {
    expect(firstAnniversary(new Date(2026, 7, 27, 20, 30))).toBe('2027-08-27');
  });

  it('el 29 de febrero retrocede al 28, no salta a marzo', () => {
    expect(firstAnniversary(new Date(2028, 1, 29, 9, 0))).toBe('2029-02-28');
  });

  it('el 31 de enero cae en enero, no en febrero', () => {
    expect(firstAnniversary(new Date(2026, 0, 31, 9, 0))).toBe('2027-01-31');
  });
});
