import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

/**
 * WO-2026-00352 — titles con intención de /services y H1 de /about.
 *
 * La metadata se importa de verdad (layout + generateMetadata del slug) para
 * que el test falle si alguien cambia el texto o rompe el template. El
 * componente cliente del detalle se sustituye porque arrastra framer-motion,
 * Header y Footer; la metadata no lo necesita. El H1 de /about se lee como
 * texto (patrón `home-wiring.test.ts`): `about/page.tsx` es `'use client'`.
 */
vi.mock('./[slug]/service-detail-client', () => ({ default: () => null }));

import { metadata as servicesMetadata } from './layout';
import { generateMetadata } from './[slug]/page';

// `%s | PixelTEC` añade 11 caracteres: para quedar ≤ 60 en el <title> final,
// el título propio debe medir ≤ 49.
const MAX_TITLE_BEFORE_SUFFIX = 49;

const EXPECTED_SLUG_TITLES: Record<string, string> = {
  'ecosistemas-web': 'Desarrollo Web y Apps a la Medida',
  'automatizacion': 'Automatización de Procesos con IA y WhatsApp',
  'consultoria': 'Consultoría Tecnológica para PyMEs',
};

function slugMetadata(slug: string) {
  return generateMetadata({ params: Promise.resolve({ slug }) });
}

describe('/services — <title> con intención (WO-2026-00352)', () => {
  it('el hub declara el title nuevo y conserva el template para los hijos', () => {
    const title = servicesMetadata.title;
    expect(title).toBeTypeOf('object');
    const { default: def, template } = title as { default: string; template: string };
    expect(def).toBe('Servicios de desarrollo web, IA y consultoría');
    expect(def.length).toBeLessThanOrEqual(MAX_TITLE_BEFORE_SUFFIX);
    expect(template).toBe('%s | PixelTEC');
  });

  it.each(Object.entries(EXPECTED_SLUG_TITLES))(
    '/services/%s → «%s»',
    async (slug, expected) => {
      const meta = await slugMetadata(slug);
      expect(meta.title).toBe(expected);
      expect(expected.length).toBeLessThanOrEqual(MAX_TITLE_BEFORE_SUFFIX);
      expect(`${expected} | PixelTEC`.length).toBeLessThanOrEqual(60);
    },
  );

  it('los slugs no tocan la description ni el canonical', async () => {
    const meta = await slugMetadata('ecosistemas-web');
    expect(meta.description).toContain('Next.js');
    expect(meta.alternates?.canonical).toBe('https://pixeltec.mx/services/ecosistemas-web');
  });

  it('un slug desconocido sigue sin metadata SEO', async () => {
    const meta = await slugMetadata('no-existe');
    expect(meta.title).toBe('Servicio no encontrado');
  });
});

describe('/about — H1 visible (WO-2026-00352)', () => {
  const source = readFileSync(resolve(__dirname, '..', 'about', 'page.tsx'), 'utf8');

  it('tiene un solo <h1 con el texto nuevo', () => {
    expect(source.match(/<h1\b/g)).toHaveLength(1);
    const h1 = source.slice(source.indexOf('<h1'), source.indexOf('</h1>'));
    expect(h1).toContain('Quiénes somos');
    expect(h1).toContain('arquitectos de software en Puerto Vallarta');
  });

  it('ya no usa el H1 anterior ni oculta el hero con opacity 0', () => {
    expect(source).not.toContain('Arquitectos de la Innovación Tecnológica');
    // REN-01: los estados iniciales de framer-motion animan solo transform;
    // un `opacity` en `hidden` dejaría el H1 invisible en el HTML del servidor.
    const hiddenStates = source.match(/hidden:\s*\{[^}]*\}/g) ?? [];
    expect(hiddenStates.length).toBeGreaterThan(0);
    for (const state of hiddenStates) expect(state).not.toMatch(/opacity/);
  });
});
