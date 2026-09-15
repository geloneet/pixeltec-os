import { describe, expect, it } from 'vitest';
import { HOME_ABOUT, HOME_HERO, HOME_SEO, HOME_SERVICES_INTRO } from './home';
import { buildMetadata } from '@/lib/seo';

const fold = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const words = (v: string) => v.trim().split(/\s+/).length;

describe('HOME_SEO — metadata de la portada', () => {
  it('title ≤ 63 y description ≤ 155 (truncado en SERP)', () => {
    // 63 y no los 60 habituales: Miguel aprobó (2026-09-14) el título con
    // «Automatización con IA» completo. Google puede recortarlo por el final
    // —después de la geo—, así que intención y ciudad sobreviven; si el
    // título crece más, hay que rehacer la decisión, no subir el límite.
    expect(HOME_SEO.title.length).toBeLessThanOrEqual(63);
    expect(HOME_SEO.title.length).toBeGreaterThan(20);
    expect(HOME_SEO.description.length).toBeLessThanOrEqual(155);
    expect(HOME_SEO.description.length).toBeGreaterThan(80);
  });

  it('title y description declaran servicio y geo', () => {
    expect(fold(HOME_SEO.title)).toMatch(/desarrollo web|software a medida/);
    expect(fold(HOME_SEO.title)).toContain('automatizacion');
    expect(fold(HOME_SEO.title)).toContain('puerto vallarta');
    expect(fold(HOME_SEO.description)).toContain('puerto vallarta');
    expect(fold(HOME_SEO.description)).toContain('guadalajara');
    expect(fold(HOME_SEO.description)).toContain('desarrollo web');
    expect(HOME_SEO.title).not.toContain('Ecosistemas Digitales y Automatización');
  });

  it('buildMetadata deja el título plano (la raíz no recibe template) y la canonical en /', () => {
    const meta = buildMetadata({ path: '/', ...HOME_SEO });
    expect(meta.title).toBe(HOME_SEO.title);
    expect(meta.alternates?.canonical).toBe('https://pixeltec.mx/');
    expect((meta.openGraph as { title?: string } | undefined)?.title).toBe(HOME_SEO.title);
  });
});

describe('HOME_HERO / HOME_ABOUT / HOME_SERVICES_INTRO — copy del servidor', () => {
  it('el H1 cabe en dos líneas cortas y nombra el servicio', () => {
    expect(HOME_HERO.title1.length).toBeLessThanOrEqual(24);
    expect(HOME_HERO.title2.length).toBeLessThanOrEqual(24);
    expect(fold(`${HOME_HERO.title1} ${HOME_HERO.title2}`)).toMatch(/desarrollo web|software/);
  });

  it('badge y subtítulo llevan la geo; subtítulo y Nosotros las keywords secundarias', () => {
    expect(fold(HOME_HERO.badge)).toContain('puerto vallarta');
    const s = fold(HOME_HERO.subtitle);
    expect(s).toContain('paginas web');
    expect(s).toContain('software a la medida');
    expect(s).toContain('whatsapp');
    expect(s).toContain('guadalajara');
    const a = fold(HOME_ABOUT.paragraph);
    expect(a).toContain('desarrollo web');
    expect(a).toContain('consultoria ti');
    expect(a).toContain('pymes');
    expect(fold(HOME_SERVICES_INTRO)).toContain('pagina web');
  });

  it('sin inflar: cada texto cabe en su bloque', () => {
    expect(words(HOME_HERO.subtitle)).toBeLessThanOrEqual(40);
    expect(words(HOME_ABOUT.paragraph)).toBeLessThanOrEqual(60);
    expect(words(HOME_SERVICES_INTRO)).toBeLessThanOrEqual(35);
  });
});
