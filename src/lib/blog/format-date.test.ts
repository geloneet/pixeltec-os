import { describe, expect, it } from 'vitest';
import { formatEditorialDate } from './format-date';

describe('formatEditorialDate', () => {
  it('instante UTC posterior a medianoche pero aún día 3 en México (19:58 local)', () => {
    expect(formatEditorialDate('2026-08-04T01:58:27.499Z')).toBe('3 de agosto de 2026');
  });

  it('instante que ya es día 4 en México (00:01 local)', () => {
    expect(formatEditorialDate('2026-08-04T06:01:00.000Z')).toBe('4 de agosto de 2026');
  });

  it('null devuelve cadena vacía', () => {
    expect(formatEditorialDate(null)).toBe('');
  });
});
