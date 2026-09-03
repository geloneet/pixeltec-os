import { describe, expect, it } from 'vitest';
import {
  KEYWORD_LANDINGS,
  KEYWORD_LANDINGS_BY_HUB,
  KEYWORD_LANDING_HUBS,
  getKeywordLanding,
  getRelatedLandings,
} from './keyword-landings';

/**
 * Contrato del registro de landings por keyword (WO-2026-00189).
 *
 * Este test es el guardarraíl de las tres partes del WorkOrder: los clústeres
 * A (software) y C (apps) se llenan después, y deben cumplir exactamente las
 * mismas reglas que el clúster B. Todo lo que aquí se verifica sale del plan
 * `docs/seo/plan-posicionamiento-puerto-vallarta-2026-09.md` §3 y §4.
 */

/** Dominios de autoridad permitidos como fuente externa (nunca Wikipedia). */
const ALLOWED_SOURCE_HOSTS = /\.(gob|org)\.mx$/;

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PV_SUFFIX = '-puerto-vallarta';

/** Comparación insensible a mayúsculas y acentos, para buscar la keyword. */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

describe('KEYWORD_LANDINGS — contrato del registro', () => {
  it('el registro no está vacío', () => {
    expect(KEYWORD_LANDINGS.length).toBeGreaterThan(0);
  });

  it('los slugs son únicos', () => {
    const slugs = KEYWORD_LANDINGS.map((landing) => landing.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it.each(KEYWORD_LANDINGS.map((landing) => [landing.slug, landing] as const))(
    '%s cumple el contrato',
    (slug, landing) => {
      // Slug: kebab-case estricto (es la ruta pública `/${slug}`).
      expect(slug, `slug no es kebab-case: ${slug}`).toMatch(SLUG_RE);

      // Metadatos: límites que Google trunca en SERP.
      expect(landing.metaTitle.length, `metaTitle > 60 en ${slug}`).toBeLessThanOrEqual(60);
      expect(landing.metaDescription.length, `metaDescription > 155 en ${slug}`).toBeLessThanOrEqual(155);
      expect(landing.metaTitle.length).toBeGreaterThan(0);
      expect(landing.metaDescription.length).toBeGreaterThan(0);

      // La keyword objetivo aparece en title y description.
      const keyword = normalize(landing.keyword);
      expect(normalize(landing.metaTitle), `metaTitle sin keyword en ${slug}`).toContain(keyword);
      expect(
        normalize(landing.metaDescription),
        `metaDescription sin keyword en ${slug}`,
      ).toContain(keyword);

      // Un solo H1 (el componente lo renderiza una vez) y una intro real.
      expect(landing.h1.trim().length).toBeGreaterThan(0);
      expect(landing.intro.trim().length).toBeGreaterThan(0);

      // 2 a 4 secciones, cada una con al menos un párrafo.
      expect(landing.sections.length, `secciones fuera de 2–4 en ${slug}`).toBeGreaterThanOrEqual(2);
      expect(landing.sections.length, `secciones fuera de 2–4 en ${slug}`).toBeLessThanOrEqual(4);
      for (const section of landing.sections) {
        expect(section.title.trim().length).toBeGreaterThan(0);
        expect(section.body.length, `sección sin cuerpo en ${slug}`).toBeGreaterThan(0);
      }

      // Casos de uso y FAQ: 5 preguntas exactas (mismo texto que el JSON-LD).
      expect(landing.useCases.length, `sin casos de uso en ${slug}`).toBeGreaterThanOrEqual(3);
      expect(landing.faq, `la FAQ de ${slug} no tiene 5 preguntas`).toHaveLength(5);
      for (const item of landing.faq) {
        expect(item.q.trim().length).toBeGreaterThan(0);
        expect(item.a.trim().length).toBeGreaterThan(0);
      }

      // Fuentes: al menos 2, solo `.gob.mx` / `.org.mx`, sin duplicados.
      expect(landing.externalSources.length, `menos de 2 fuentes en ${slug}`).toBeGreaterThanOrEqual(2);
      for (const source of landing.externalSources) {
        const url = new URL(source.href);
        expect(url.protocol, `fuente no https en ${slug}: ${source.href}`).toBe('https:');
        expect(
          url.hostname,
          `dominio de fuente no permitido en ${slug}: ${source.href}`,
        ).toMatch(ALLOWED_SOURCE_HOSTS);
        expect(source.label.trim().length).toBeGreaterThan(0);
      }
      const hrefs = landing.externalSources.map((source) => source.href);
      expect(new Set(hrefs).size, `fuentes duplicadas en ${slug}`).toBe(hrefs.length);

      // Enlazado interno: todos los relatedSlugs existen y ninguno es sí mismo.
      for (const related of landing.relatedSlugs) {
        expect(
          getKeywordLanding(related),
          `relatedSlug inexistente en ${slug}: ${related}`,
        ).toBeDefined();
      }
      expect(landing.relatedSlugs, `${slug} se enlaza a sí misma`).not.toContain(slug);
      expect(new Set(landing.relatedSlugs).size).toBe(landing.relatedSlugs.length);

      // Hub declarado y registrado.
      expect(KEYWORD_LANDING_HUBS[landing.hub], `hub desconocido en ${slug}`).toBeDefined();

      // Ciudad ⇒ contexto local propio (regla anti-doorway) y slug con sufijo.
      if (landing.city) {
        expect(landing.city.name).toBe('Puerto Vallarta');
        expect(landing.city.region).toBe('Jalisco');
        expect(landing.localContext, `city sin localContext en ${slug}`).toBeDefined();
        expect(landing.localContext?.body.length ?? 0).toBeGreaterThan(0);
        expect(slug.endsWith(PV_SUFFIX), `landing con city sin sufijo local: ${slug}`).toBe(true);
        expect(landing.metaTitle).toContain('Puerto Vallarta');
      } else {
        expect(landing.localContext, `localContext sin city en ${slug}`).toBeUndefined();
        expect(slug.endsWith(PV_SUFFIX), `slug local sin city: ${slug}`).toBe(false);
      }

      // CTA acotado a las dos rutas de conversión del sitio.
      expect(['/contact', '/diagnostico']).toContain(landing.ctaHref);
      expect(landing.ctaVerb.trim().length).toBeGreaterThan(0);
    },
  );

  it('cada variante de Puerto Vallarta enlaza a su genérica y viceversa', () => {
    for (const landing of KEYWORD_LANDINGS) {
      if (!landing.city) continue;
      const genericSlug = landing.slug.slice(0, -PV_SUFFIX.length);
      const generic = getKeywordLanding(genericSlug);
      if (!generic) continue; // la genérica puede llegar en otra parte del WO
      expect(
        landing.relatedSlugs,
        `${landing.slug} no enlaza a su genérica`,
      ).toContain(genericSlug);
      expect(
        generic.relatedSlugs,
        `${genericSlug} no enlaza a su variante local`,
      ).toContain(landing.slug);
    }
  });

  it('las variantes locales no repiten el texto de la genérica', () => {
    for (const landing of KEYWORD_LANDINGS) {
      if (!landing.city) continue;
      const generic = getKeywordLanding(landing.slug.slice(0, -PV_SUFFIX.length));
      if (!generic) continue;
      expect(landing.intro, `${landing.slug} repite la intro de su genérica`).not.toBe(generic.intro);
      const localFaq = landing.faq.map((item) => item.q);
      const genericFaq = new Set(generic.faq.map((item) => item.q));
      const shared = localFaq.filter((question) => genericFaq.has(question));
      expect(shared, `${landing.slug} repite preguntas de la FAQ genérica`).toEqual([]);
    }
  });
});

describe('helpers del registro', () => {
  it('getKeywordLanding resuelve por slug y devuelve undefined si no existe', () => {
    const first = KEYWORD_LANDINGS[0];
    expect(getKeywordLanding(first.slug)).toBe(first);
    expect(getKeywordLanding('slug-que-no-existe')).toBeUndefined();
  });

  it('getRelatedLandings devuelve las landings declaradas, en orden', () => {
    for (const landing of KEYWORD_LANDINGS) {
      const related = getRelatedLandings(landing.slug);
      expect(related.map((item) => item.slug)).toEqual(landing.relatedSlugs);
    }
    expect(getRelatedLandings('slug-que-no-existe')).toEqual([]);
  });

  it('KEYWORD_LANDINGS_BY_HUB particiona el registro completo', () => {
    const grouped = [...KEYWORD_LANDINGS_BY_HUB['ecosistemas-web'], ...KEYWORD_LANDINGS_BY_HUB.automatizacion];
    expect(grouped).toHaveLength(KEYWORD_LANDINGS.length);
    for (const hub of Object.keys(KEYWORD_LANDINGS_BY_HUB) as (keyof typeof KEYWORD_LANDINGS_BY_HUB)[]) {
      for (const landing of KEYWORD_LANDINGS_BY_HUB[hub]) {
        expect(landing.hub).toBe(hub);
      }
    }
  });
});
