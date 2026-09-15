import { describe, expect, it } from 'vitest';
import { CONSULTORIA_CITIES, DESARROLLO_WEB_CITIES, getLocalServiceCity, type LocalServiceCity } from './local-services';
import { LOCAL_AUTOMATION_CITIES, getLocalCity, type LocalCity } from './automatizacion-local';
import { KEYWORD_LANDINGS } from './keyword-landings';
import { industriesWithPage } from './industrias';

/**
 * L4 (WO-2026-00345): las 12 landings ciudad×servicio no tenían test de
 * límites ni de enlaces. `localProof` (prueba local verificable) solo puede
 * nombrar clientes con ubicación documentada en 03_CLIENTES y con la
 * ubicación REAL: Villa Nogal está en San Sebastián del Oeste, Smile More en
 * Guadalajara y Guamúchil. Los demás clientes no se usan hasta que Miguel
 * documente dónde están.
 */
type AnyCity = LocalServiceCity | LocalCity;
const ALL: AnyCity[] = [...DESARROLLO_WEB_CITIES, ...CONSULTORIA_CITIES, ...LOCAL_AUTOMATION_CITIES];
const ALL_SLUGS = new Set(ALL.map((c) => c.slug));
const INDUSTRY_PAGES = new Set(industriesWithPage().map((i) => i.page.slug));
const EXISTING_HREFS = new Set([
  '/services/ecosistemas-web',
  '/services/automatizacion',
  '/services/consultoria',
  '/industrias',
  '/diagnostico',
  '/contact',
  ...[...ALL_SLUGS].map((s) => `/${s}`),
  ...KEYWORD_LANDINGS.map((l) => `/${l.slug}`),
  ...[...INDUSTRY_PAGES].map((s) => `/industrias/${s}`),
]);

/** Cliente → fragmento de ubicación que la ficha documenta y que el texto debe respetar. */
const CLIENT_LOCATION: Record<string, RegExp> = {
  'Villa Nogal': /San Sebastián del Oeste/,
  'Smile More': /Guadalajara/,
};
/** Clientes cuya ficha NO los ubica en Puerto Vallarta: nunca «en Puerto Vallarta». */
const NOT_IN_PV = ['Villa Nogal', 'Smile More', 'Pipas', 'Tondoroque', 'Transportes Sánchez', 'Velank', 'Barrostock', 'DALK'];

describe('registros de landings ciudad×servicio', () => {
  it('12 landings con slugs únicos, title ≤ 60 y description ≤ 155', () => {
    expect(ALL).toHaveLength(12);
    expect(ALL_SLUGS.size).toBe(12);
    for (const c of ALL) {
      expect(c.metaTitle.length, c.slug).toBeLessThanOrEqual(60);
      expect(c.metaDescription.length, c.slug).toBeLessThanOrEqual(155);
      expect(c.faq.length, c.slug).toBeGreaterThanOrEqual(3);
    }
  });

  it('neighborSlugs apuntan a landings del mismo registro', () => {
    for (const c of ALL) for (const n of c.neighborSlugs) expect(ALL_SLUGS.has(n), `${c.slug} → ${n}`).toBe(true);
  });

  it('localProof: enlaces existentes y chips de industria solo a páginas reales', () => {
    for (const c of ALL) {
      if (c.localProof) {
        expect(c.localProof.title.length).toBeGreaterThan(5);
        expect(c.localProof.body.length).toBeGreaterThanOrEqual(1);
        expect(c.localProof.links.length).toBeGreaterThanOrEqual(1);
        for (const l of c.localProof.links) expect(EXISTING_HREFS.has(l.href), `${c.slug} → ${l.href}`).toBe(true);
      }
      for (const s of c.relatedIndustrySlugs ?? []) expect(INDUSTRY_PAGES.has(s), `${c.slug} → ${s}`).toBe(true);
    }
  });

  it('guardarraíl de ubicación: cada cliente nombrado lleva su ubicación real y nunca «en Puerto Vallarta»', () => {
    for (const c of ALL) {
      if (!c.localProof) continue;
      const text = c.localProof.body.join(' ');
      for (const [client, location] of Object.entries(CLIENT_LOCATION)) {
        if (text.includes(client)) expect(text, `${c.slug}: ${client} sin ubicación real`).toMatch(location);
      }
      for (const client of NOT_IN_PV) {
        expect(text, `${c.slug}: «${client} … en Puerto Vallarta»`).not.toMatch(new RegExp(`${client}[^.]*\\ben Puerto Vallarta\\b`));
      }
      // Voz comercial: sin estado interno ni decisiones del cliente en lo público.
      expect(text, `${c.slug}: estado interno del cliente`).not.toMatch(/en pausa|por decisión del (proyecto|cliente)|en diseño|monitoreo y estabilización/i);
    }
  });

  it('las 4 landings con prueba local documentada la tienen; el resto no inventa', () => {
    expect(getLocalServiceCity('desarrollo-web-guadalajara')?.localProof?.body.join(' ')).toMatch(/Smile More/);
    expect(getLocalCity('automatizacion-guadalajara')?.localProof?.body.join(' ')).toMatch(/Smile More/);
    expect(getLocalServiceCity('desarrollo-web-puerto-vallarta')?.localProof?.body.join(' ')).toMatch(/Villa Nogal/);
    expect(getLocalServiceCity('desarrollo-web-bahia-de-banderas')?.localProof?.body.join(' ')).toMatch(/Villa Nogal/);
    expect(getLocalServiceCity('desarrollo-web-guadalajara')?.relatedIndustrySlugs).toEqual(['clinicas-dentales']);
    expect(getLocalServiceCity('desarrollo-web-puerto-vallarta')?.relatedIndustrySlugs).toEqual(['hoteles']);
    // Sin ubicación documentada ⇒ sin prueba local (Zapopan, consultoría, resto de automatización).
    for (const slug of ['desarrollo-web-zapopan', 'consultoria-zapopan', 'consultoria-guadalajara', 'automatizacion-zapopan', 'automatizacion-bahia-de-banderas']) {
      expect(getLocalServiceCity(slug)?.localProof ?? getLocalCity(slug)?.localProof).toBeUndefined();
    }
  });
});
