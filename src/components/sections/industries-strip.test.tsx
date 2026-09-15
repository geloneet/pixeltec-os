// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import IndustriesStrip from './industries-strip';
import { INDUSTRIES, industriesWithPage } from '@/lib/content/industrias';

afterEach(cleanup);

/**
 * L2 (WO-2026-00345): el strip del home sigue mostrando los 6 sectores del
 * registro; los que tienen página propia se enlazan (2), el resto es texto.
 */
describe('IndustriesStrip — 6 sectores, 2 enlazados', () => {
  it('pinta un <li> por sector, en el orden del registro', () => {
    render(<IndustriesStrip />);
    const list = screen.getByRole('list');
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(INDUSTRIES.length);
    expect(items.map((li) => li.textContent?.trim())).toEqual(INDUSTRIES.map((i) => i.shortLabel));
  });

  it('enlaza exactamente las industrias con página + el hub', () => {
    render(<IndustriesStrip />);
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    const pageHrefs = industriesWithPage().map((i) => `/industrias/${i.page.slug}`);
    expect(pageHrefs).toHaveLength(2);
    for (const h of pageHrefs) expect(hrefs).toContain(h);
    expect(hrefs.filter((h) => h?.startsWith('/industrias/'))).toHaveLength(2);
    expect(hrefs.filter((h) => h === '/industrias')).toHaveLength(1);
  });
});
