// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { DESARROLLO_WEB_CITIES, getLocalServiceCity, type LocalServiceCity } from '@/lib/content/local-services';
import { getLocalCity, type LocalCity } from '@/lib/content/automatizacion-local';

// Header/Footer arrastran next/navigation y next-auth; aquí solo importa el <main>.
vi.mock('@/components/header', () => ({ default: () => null }));
vi.mock('@/components/ui/footer-section', () => ({ Footer: () => null }));

import LocalServicePage from './local-service-page';
import LocalAutomationPage from './local-automation-page';

beforeAll(() => {
  // framer-motion `whileInView` observa el viewport; jsdom no lo implementa.
  class IO {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
  }
  Object.defineProperty(globalThis, 'IntersectionObserver', { writable: true, value: IO });
});
afterEach(cleanup);

/**
 * L4 (WO-2026-00345): sección «Trabajo real» (`localProof`) entre «Casos de
 * uso» y «Cómo trabajamos», SOLO cuando el registro la trae; chips a las
 * páginas de industria relacionadas. Nada oculto con `opacity:0`.
 */
describe('LocalServicePage — localProof y chips de industria', () => {
  const withProof = getLocalServiceCity('desarrollo-web-guadalajara')!;
  const withoutProof: LocalServiceCity = { ...DESARROLLO_WEB_CITIES[0], localProof: undefined, relatedIndustrySlugs: undefined };
  const props = { serviceHref: '/services/ecosistemas-web', serviceLabel: 'Ecosistemas Web Avanzados', ctaVerb: 'desarrollar tu proyecto' };

  it('sin localProof no hay sección de prueba local ni chips', () => {
    render(<LocalServicePage city={withoutProof} {...props} />);
    expect(screen.queryByRole('region', { name: /trabajo real/i })).toBeNull();
    expect(screen.queryAllByRole('link').map((a) => a.getAttribute('href')).filter((h) => h?.startsWith('/industrias/'))).toEqual([]);
  });

  it('con localProof aparece la sección con su título, cuerpo y enlaces, después de los casos de uso', () => {
    const { container } = render(<LocalServicePage city={withProof} {...props} />);
    const section = screen.getByRole('region', { name: withProof.localProof!.title });
    for (const p of withProof.localProof!.body) expect(section.textContent).toContain(p);
    for (const l of withProof.localProof!.links) {
      expect(within(section).getByRole('link', { name: l.label }).getAttribute('href')).toBe(l.href);
    }
    const h2 = [...container.querySelectorAll('h2')].map((h) => h.textContent);
    const proofIdx = h2.indexOf(withProof.localProof!.title);
    expect(proofIdx).toBeGreaterThan(h2.findIndex((t) => t?.startsWith('Casos de uso')));
    expect(proofIdx).toBeLessThan(h2.indexOf('Cómo trabajamos'));
    expect(container.innerHTML).not.toMatch(/opacity:\s*0/);
  });

  it('relatedIndustrySlugs pinta chips a /industrias/<slug>', () => {
    render(<LocalServicePage city={withProof} {...props} />);
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    for (const slug of withProof.relatedIndustrySlugs ?? []) expect(hrefs).toContain(`/industrias/${slug}`);
  });
});

describe('LocalAutomationPage — localProof', () => {
  const withProof = getLocalCity('automatizacion-guadalajara')!;
  const withoutProof: LocalCity = { ...getLocalCity('automatizacion-zapopan')!, localProof: undefined, relatedIndustrySlugs: undefined };

  it('sin localProof no hay sección', () => {
    render(<LocalAutomationPage city={withoutProof} />);
    expect(screen.queryByRole('region', { name: /automatización real|trabajo real/i })).toBeNull();
  });

  it('con localProof aparece la sección con enlaces y chips', () => {
    const { container } = render(<LocalAutomationPage city={withProof} />);
    const section = screen.getByRole('region', { name: withProof.localProof!.title });
    expect(section.textContent).toContain('Smile More');
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    for (const l of withProof.localProof!.links) expect(hrefs).toContain(l.href);
    for (const slug of withProof.relatedIndustrySlugs ?? []) expect(hrefs).toContain(`/industrias/${slug}`);
    expect(container.innerHTML).not.toMatch(/opacity:\s*0/);
  });
});
