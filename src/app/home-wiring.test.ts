import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * `page.tsx` arrastra server actions y la base de datos al importarse, así que
 * este guardarraíl lee el archivo como texto: confirma que la portada monta lo
 * que WO-2026-00343 añadió, sin ejecutar nada. Si alguien quita un import, el
 * test lo dice por su nombre.
 */
const source = readFileSync(resolve(__dirname, 'page.tsx'), 'utf8');

describe('src/app/page.tsx — cableado SEO (WO-2026-00343)', () => {
  it('emite el JSON-LD propio del home', () => {
    expect(source).toContain("from '@/components/seo/home-structured-data'");
    expect(source).toContain('<HomeStructuredData />');
  });

  it('monta el bloque de enlaces a landings dentro de <main>', () => {
    expect(source).toContain("from '@/components/sections/local-landings'");
    const main = source.slice(source.indexOf('<main'), source.indexOf('</main>'));
    expect(main).toContain('<LocalLandingsSection />');
  });

  it('la metadata y el hero salen de HOME_SEO / HOME_HERO', () => {
    expect(source).toContain("from '@/lib/content/home'");
    expect(source).toContain('...HOME_SEO');
    expect(source).toContain('<HeroGeometric {...HOME_HERO} />');
    expect(source).not.toContain('Ecosistemas Digitales y Automatización');
  });
});
