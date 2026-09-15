// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TestimonialsWithMarquee } from './testimonials-with-marquee';

/**
 * Regresión (WO-2026-00345, L4 — hallazgo F de la auditoría): el marquee
 * duplica cada testimonio para el bucle CSS. La copia DEBE ir en un contenedor
 * `aria-hidden="true"` + `inert` (accesibilidad) y con `prefers-reduced-motion`
 * o < 4 ítems no se clona nada. Este test fija ese contrato sin cambiar el
 * componente.
 */
const NAMES = ['Aidee García', 'Juan Antonio Sánchez', 'Juan Sánchez', 'Francisco Arredondo', 'Polett Niebla'];
const testimonials = NAMES.map((name, i) => ({
  text: `Testimonio ${i + 1}`,
  author: { name, title: `Cargo ${i + 1}`, icon: null },
}));

function mockMatchMedia(reduce: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: reduce && query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

beforeEach(() => {
  class IO {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
  }
  Object.defineProperty(globalThis, 'IntersectionObserver', { writable: true, configurable: true, value: IO });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('TestimonialsWithMarquee — clon accesible y estático con reduced-motion', () => {
  it('con 5 testimonios y movimiento normal: la copia va en aria-hidden + inert y cada nombre es visible una sola vez', () => {
    mockMatchMedia(false);
    const { container } = render(<TestimonialsWithMarquee title="Título" description="Desc" testimonials={testimonials} />);
    const clones = container.querySelectorAll('[aria-hidden="true"].flex');
    expect(clones).toHaveLength(1);
    // `inert` es booleano en React 19 (el runtime del App Router); React 18 de
    // jsdom lo omite, así que el contrato se fija en el markup fuente.
    const src = readFileSync(resolve(__dirname, 'testimonials-with-marquee.tsx'), 'utf8');
    expect(src).toMatch(/aria-hidden="true"\s+inert/);
    for (const name of NAMES) {
      const all = screen.getAllByText(name);
      expect(all).toHaveLength(2);
      const visible = all.filter((el) => el.closest('[aria-hidden="true"]') === null);
      expect(visible, name).toHaveLength(1);
    }
  });

  it('con prefers-reduced-motion no hay clones: cada nombre aparece exactamente una vez', () => {
    mockMatchMedia(true);
    const { container } = render(<TestimonialsWithMarquee title="Título" description="Desc" testimonials={testimonials} />);
    expect(container.querySelectorAll('[aria-hidden="true"].flex')).toHaveLength(0);
    for (const name of NAMES) expect(screen.getAllByText(name)).toHaveLength(1);
    expect(container.querySelector('.marquee-track')).toBeNull();
  });

  it('con menos de 4 testimonios tampoco se clona', () => {
    mockMatchMedia(false);
    const { container } = render(
      <TestimonialsWithMarquee title="Título" description="Desc" testimonials={testimonials.slice(0, 3)} />,
    );
    expect(container.querySelectorAll('[aria-hidden="true"].flex')).toHaveLength(0);
    for (const name of NAMES.slice(0, 3)) expect(screen.getAllByText(name)).toHaveLength(1);
  });
});
