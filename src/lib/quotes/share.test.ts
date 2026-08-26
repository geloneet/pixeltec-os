import { describe, it, expect } from 'vitest';
import { toWhatsAppNumber, buildWhatsAppMessage, buildWhatsAppLink, buildEmailSubject } from './share';

/** WO-2026-00101 — envío por WhatsApp mediante enlace, no por la API de Meta. */

const base = {
  clientName: 'Muebles Encino',
  folio: 'COT-2026-0007',
  title: 'Sitio web institucional',
  total: '$46,400.00',
  url: 'https://pixeltec.mx/c/abc123',
};

describe('normalización del teléfono', () => {
  it('antepone 52 a un número mexicano de 10 dígitos', () => {
    expect(toWhatsAppNumber('3221234567')).toBe('523221234567');
    expect(toWhatsAppNumber('(322) 123 4567')).toBe('523221234567');
  });

  it('quita el «1» de móvil de la forma antigua 521…', () => {
    expect(toWhatsAppNumber('5213221234567')).toBe('523221234567');
  });

  it('respeta un internacional ya completo', () => {
    expect(toWhatsAppNumber('+1 415 555 0123')).toBe('14155550123');
  });

  it('devuelve null en vez de inventarse un número', () => {
    for (const bad of ['', null, undefined, '123', 'sin teléfono', '9999999999999999999']) {
      expect(toWhatsAppNumber(bad), String(bad)).toBeNull();
    }
  });
});

describe('mensaje', () => {
  it('nombra al cliente, el folio, el total y el enlace', () => {
    const msg = buildWhatsAppMessage(base);
    expect(msg).toContain('Muebles Encino');
    expect(msg).toContain('COT-2026-0007');
    expect(msg).toContain('$46,400.00');
    expect(msg).toContain('https://pixeltec.mx/c/abc123');
  });

  it('incluye la vigencia solo si la hay', () => {
    expect(buildWhatsAppMessage(base)).not.toContain('Vigencia');
    expect(buildWhatsAppMessage({ ...base, validUntil: '30 de septiembre' })).toContain('Vigencia');
  });
});

describe('enlace', () => {
  it('apunta a wa.me con el mensaje codificado', () => {
    const link = buildWhatsAppLink('3221234567', base);
    expect(link).toMatch(/^https:\/\/wa\.me\/523221234567\?text=/);
    expect(link).toContain(encodeURIComponent('COT-2026-0007'));
    // El enlace se codifica entero: ningún salto de línea crudo en la URL.
    expect(link).not.toMatch(/\n/);
  });

  it('sin teléfono utilizable no hay enlace — el botón se esconde', () => {
    expect(buildWhatsAppLink(null, base)).toBeNull();
    expect(buildWhatsAppLink('123', base)).toBeNull();
  });

  it('NUNCA apunta a la API de Meta: el módulo WhatsApp está congelado', () => {
    const link = buildWhatsAppLink('3221234567', base) ?? '';
    expect(link).not.toContain('graph.facebook.com');
    expect(link).toContain('wa.me');
  });
});

describe('asunto del correo', () => {
  it('lleva folio y título', () => {
    expect(buildEmailSubject(base)).toBe('Cotización COT-2026-0007 — Sitio web institucional');
  });
});
