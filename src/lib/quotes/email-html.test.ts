import { describe, it, expect } from 'vitest';
import { renderQuoteEmailHtml, escapeHtml } from './email-html';

/** WO-2026-00102 — cuerpo del correo de la cotización. */

const base = {
  clientName: 'Muebles Encino',
  folio: 'COT-2026-0007',
  title: 'Sitio web institucional',
  total: '$46,400.00',
  url: 'https://pixeltec.mx/c/abc123',
};

describe('escape', () => {
  it('neutraliza el HTML que venga de la base de datos', () => {
    expect(escapeHtml('<script>alert(1)</script>')).not.toContain('<script>');
    expect(escapeHtml('Tom & "Jerry"')).toBe('Tom &amp; &quot;Jerry&quot;');
  });
});

describe('correo', () => {
  it('lleva cliente, folio, título, total y enlace', () => {
    const html = renderQuoteEmailHtml(base);
    for (const part of ['Muebles Encino', 'COT-2026-0007', 'Sitio web institucional', '$46,400.00', base.url]) {
      expect(html).toContain(part);
    }
  });

  it('la vigencia solo aparece si la hay', () => {
    expect(renderQuoteEmailHtml(base)).not.toContain('Vigencia');
    expect(renderQuoteEmailHtml({ ...base, validUntil: '30 de septiembre de 2026' })).toContain('Vigencia');
  });

  it('un nombre de cliente con HTML no se inyecta en el correo', () => {
    const html = renderQuoteEmailHtml({ ...base, clientName: '<img src=x onerror=alert(1)>' });
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img');
  });
});
