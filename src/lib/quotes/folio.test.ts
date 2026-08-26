import { describe, it, expect } from 'vitest';
import { buildFolio, parseFolio, nextFolio } from './folio';

/** WO-2026-00101 — folio de cotización. */

describe('folio', () => {
  it('se construye con año y consecutivo de 4 dígitos', () => {
    expect(buildFolio(2026, 1)).toBe('COT-2026-0001');
    expect(buildFolio(2026, 137)).toBe('COT-2026-0137');
  });

  it('no trunca cuando se pasan de 9999', () => {
    expect(buildFolio(2026, 12345)).toBe('COT-2026-12345');
    expect(parseFolio('COT-2026-12345')?.sequence).toBe(12345);
  });

  it('se lee de vuelta', () => {
    expect(parseFolio('COT-2026-0042')).toEqual({ year: 2026, sequence: 42 });
    expect(parseFolio('  COT-2026-0042  ')).toEqual({ year: 2026, sequence: 42 });
  });

  it('rechaza lo que no tiene la forma esperada', () => {
    for (const bad of ['', 'COT-2026', 'X-2026-0001', 'COT-26-0001', 'COT-2026-1']) {
      expect(parseFolio(bad), bad).toBeNull();
    }
  });

  it('el consecutivo avanza sobre el mayor del año', () => {
    expect(nextFolio(2026, ['COT-2026-0001', 'COT-2026-0003', 'COT-2026-0002'])).toBe('COT-2026-0004');
  });

  it('el consecutivo reinicia cada año', () => {
    expect(nextFolio(2027, ['COT-2026-0099'])).toBe('COT-2027-0001');
  });

  it('sin cotizaciones previas empieza en 0001', () => {
    expect(nextFolio(2026, [])).toBe('COT-2026-0001');
  });

  it('un folio ilegible heredado no bloquea el siguiente', () => {
    expect(nextFolio(2026, ['basura', 'COT-2026-0007', ''])).toBe('COT-2026-0008');
  });
});
