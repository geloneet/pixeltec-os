import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getSitePage } from './page-schema';

/**
 * L3 (WO-2026-00345): titles con intención y descriptions dentro de los
 * límites. Los `page.tsx`/`layout.tsx` arrastran Header, DB o next/navigation,
 * así que se leen como texto (patrón `home-wiring.test.ts`). El segmento
 * propio del title va ≤ 49 porque el layout raíz añade « | PixelTEC» (11).
 */
const APP = resolve(__dirname, '..', '..', 'app');

function metaOf(file: string): { title: string; description: string } {
  const src = readFileSync(file, 'utf8');
  const title = /title:\s*(?:BLOG_INDEX_TITLE|'([^']*)')/.exec(src)?.[1] ?? /const BLOG_INDEX_TITLE = '([^']*)'/.exec(src)?.[1] ?? '';
  const description =
    /description:\s*'([^']*)'/.exec(src)?.[1] ?? /const BLOG_INDEX_DESCRIPTION = '([^']*)'/.exec(src)?.[1] ?? '';
  return { title, description };
}

const CASES: { path: string; file: string; title: string }[] = [
  { path: '/about', file: resolve(APP, 'about', 'layout.tsx'), title: 'Quiénes somos · Software en Puerto Vallarta' },
  { path: '/blog', file: resolve(APP, 'blog', 'page.tsx'), title: 'Blog: IA, software y automatización para pymes' },
  { path: '/contact', file: resolve(APP, 'contact', 'layout.tsx'), title: 'Contacto · Hablemos de tu proyecto' },
];

describe('titles y descriptions de /about, /blog y /contact (WO-2026-00345 L3)', () => {
  for (const c of CASES) {
    it(`${c.path}: title aprobado (≤ 49 + « | PixelTEC» ≤ 60) y description ≤ 155`, () => {
      const meta = metaOf(c.file);
      expect(meta.title).toBe(c.title);
      expect(meta.title.length).toBeLessThanOrEqual(49);
      expect(`${meta.title} | PixelTEC`.length).toBeLessThanOrEqual(60);
      expect(meta.description.length).toBeGreaterThan(60);
      expect(meta.description.length).toBeLessThanOrEqual(155);
    });
  }

  it('/about y /contact llevan geo y categoría en la description', () => {
    expect(metaOf(CASES[0].file).description).toMatch(/Puerto Vallarta/);
    expect(metaOf(CASES[2].file).description).toMatch(/Puerto Vallarta, Jalisco/);
    expect(metaOf(CASES[2].file).description).toMatch(/diagnóstico gratuito/);
  });

  it('el catálogo del panel describe /about y /blog como lo que son hoy', () => {
    expect(getSitePage('/about')?.description).toMatch(/Puerto Vallarta/);
    expect(getSitePage('/blog')?.description).toMatch(/pymes/i);
  });
});
