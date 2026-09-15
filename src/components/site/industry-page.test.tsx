// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { IndustryPage } from './industry-page';
import { industriesWithPage } from '@/lib/content/industrias';

afterEach(cleanup);

/**
 * L2 (WO-2026-00345): la página de industria es Server Component (REN-01:
 * todo el texto viaja en el HTML inicial, sin `opacity:0`), con un solo H1,
 * un H2 por sección, el caso real con nombre del cliente, la FAQ visible con
 * el MISMO texto que el FAQPage y los enlaces a servicios y landings.
 */
describe('IndustryPage — RSC con el patrón de las landings', () => {
  it('es Server Component: sin "use client" ni framer-motion', () => {
    const src = readFileSync(resolve(__dirname, 'industry-page.tsx'), 'utf8');
    expect(src).not.toMatch(/['"]use client['"]/);
    expect(src).not.toContain('framer-motion');
  });

  for (const industry of industriesWithPage()) {
    const page = industry.page;

    it(`${page.slug}: 1 H1, H2 por sección, caso real, FAQ y CTA`, () => {
      render(<IndustryPage industry={industry} />);
      const h1 = screen.getAllByRole('heading', { level: 1 });
      expect(h1).toHaveLength(1);
      expect(h1[0].textContent).toBe(page.h1);

      const h2 = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
      for (const s of page.sections) expect(h2).toContain(s.title);
      expect(h2).toContain(page.caseStudy.title);
      expect(h2).toContain('Preguntas frecuentes');
      expect(h2.length).toBeGreaterThanOrEqual(4);

      const caso = screen.getByRole('region', { name: page.caseStudy.title });
      expect(caso.textContent).toContain(page.caseStudy.client);
      expect(caso.textContent).toContain(page.caseStudy.location);

      const faq = screen.getByRole('region', { name: 'Preguntas frecuentes' });
      for (const f of page.faq) {
        expect(within(faq).getByText(f.q)).toBeTruthy();
        expect(within(faq).getByText(f.a)).toBeTruthy();
      }

      const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
      for (const s of page.relatedServices) expect(hrefs).toContain(s.href);
      for (const slug of page.relatedLandings) expect(hrefs).toContain(`/${slug}`);
      expect(hrefs).toContain(page.ctaHref);
      expect(hrefs).toContain('/contact');
      expect(hrefs).toContain('/industrias');
    });

    it(`${page.slug}: no esconde contenido con opacity 0`, () => {
      const { container } = render(<IndustryPage industry={industry} />);
      expect(container.innerHTML).not.toMatch(/opacity:\s*0/);
      // ≥ 600 palabras visibles: el mínimo de sustancia de una página propia.
      const words = (container.textContent ?? '').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
      expect(words.length).toBeGreaterThanOrEqual(600);
    });
  }
});
