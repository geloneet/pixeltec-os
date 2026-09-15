// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GoogleBusinessCard } from './google-business-card';
import { SITE } from '@/lib/site-config';

afterEach(cleanup);

/**
 * L6 (WO-2026-00346): la ficha de Google se embebe por CID (nunca por
 * `maps?q=`), carga lazy y enlaza a la ficha pública. Sin estrellas ni
 * calificación: no hay datos de reseñas verificados.
 */
describe('GoogleBusinessCard', () => {
  it('embebe la ficha por CID con iframe lazy, título y referrerPolicy', () => {
    const { container } = render(<GoogleBusinessCard />);
    const iframe = container.querySelector('iframe')!;
    expect(iframe).not.toBeNull();
    expect(iframe.getAttribute('src')).toBe('https://www.google.com/maps/embed?origin=mfe&pb=!1m3!3m2!1m1!4s13326669911837798484');
    expect(iframe.getAttribute('src')).toBe(SITE.googleBusinessProfile.embedUrl);
    expect(iframe.getAttribute('src')).not.toMatch(/maps\?q=/);
    expect(iframe.getAttribute('loading')).toBe('lazy');
    expect(iframe.getAttribute('title')).toMatch(/PixelTEC/);
    expect(iframe.getAttribute('referrerpolicy')).toBe('no-referrer-when-downgrade');
  });

  it('enlaza a la ficha pública en pestaña nueva con rel="noreferrer"', () => {
    render(<GoogleBusinessCard />);
    const link = screen.getByRole('link', { name: /Ver ficha en Google/ });
    expect(link.getAttribute('href')).toBe('https://maps.app.goo.gl/fAiYRnLg53tx6VRF7');
    expect(link.getAttribute('href')).toBe(SITE.googleBusinessProfile.url);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noreferrer');
  });

  it('muestra el nombre y el NAP de site-config, sin estrellas ni calificación', () => {
    const { container } = render(<GoogleBusinessCard />);
    expect(container.textContent).toContain('PixelTEC en Google');
    expect(container.textContent).toContain(SITE.address.locality);
    expect(container.textContent).toContain(SITE.phone.display);
    expect(container.innerHTML).not.toMatch(/★|estrella|rating|reseña|califica/i);
    expect(container.querySelector('svg')).toBeNull();
    const src = readFileSync(resolve(__dirname, 'google-business-card.tsx'), 'utf8');
    expect(src).not.toMatch(/ratingValue|reviewCount|Stars/);
  });
});
