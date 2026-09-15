// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LocalLandingsSection } from './local-landings';
import { getHomeGuideLinks, getHomeLandingGroups } from '@/lib/content/home-landings';

afterEach(cleanup);

describe('LocalLandingsSection — enlaces a landings en el HTML (REN-01)', () => {
  it('es Server Component: sin "use client" ni framer-motion', () => {
    const src = readFileSync(resolve(__dirname, 'local-landings.tsx'), 'utf8');
    expect(src).not.toMatch(/['"]use client['"]/);
    expect(src).not.toContain('framer-motion');
  });

  it('pinta H2, un H3 por grupo + «Guías para decidir», y los 18 enlaces esperados', () => {
    render(<LocalLandingsSection />);
    const section = screen.getByRole('region', { name: /en tu ciudad/i });
    expect(within(section).getByRole('heading', { level: 2 }).textContent).toBe(
      'Desarrollo web y automatización en tu ciudad',
    );
    expect(within(section).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Desarrollo web',
      'Automatización con IA',
      'Consultoría TI',
      'Guías para decidir',
    ]);
    const expected = [...getHomeLandingGroups().flatMap((g) => g.links), ...getHomeGuideLinks()];
    expect(expected).toHaveLength(18);
    const anchors = within(section).getAllByRole('link');
    expect(anchors).toHaveLength(expected.length);
    expect(anchors.map((a) => [a.getAttribute('href'), a.textContent])).toEqual(expected.map((l) => [l.href, l.label]));
  });

  it('no esconde nada con opacity 0 inicial', () => {
    const { container } = render(<LocalLandingsSection />);
    expect(container.innerHTML).not.toMatch(/opacity:\s*0/);
  });
});
