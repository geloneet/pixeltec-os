import { describe, expect, it } from 'vitest';
import { HOME_CITY_ORDER, HOME_FEATURED_KEYWORD_SLUGS, getHomeGuideLinks, getHomeLandingGroups } from './home-landings';
import { KEYWORD_LANDINGS, getKeywordLanding } from './keyword-landings';
import { LOCAL_AUTOMATION_CITIES } from './automatizacion-local';
import { CONSULTORIA_CITIES, DESARROLLO_WEB_CITIES } from './local-services';

describe('getHomeLandingGroups — 3 servicios × ciudades del registro', () => {
  const groups = getHomeLandingGroups();

  it('tiene un grupo por servicio, en el orden Desarrollo web → Automatización → Consultoría', () => {
    expect(groups.map((g) => g.id)).toEqual(['ecosistemas-web', 'automatizacion', 'consultoria']);
    expect(groups.map((g) => g.title)).toEqual(['Desarrollo web', 'Automatización con IA', 'Consultoría TI']);
  });

  it('respeta el orden de cobertura de Miguel: Puerto Vallarta → Bahía de Banderas → Guadalajara → Zapopan', () => {
    expect(HOME_CITY_ORDER).toEqual(['Puerto Vallarta', 'Bahía de Banderas', 'Guadalajara', 'Zapopan']);
    for (const group of groups) {
      const cities = group.links.map((l) => l.label.replace(/^.*? en /, ''));
      expect(cities).toEqual([...HOME_CITY_ORDER]);
    }
  });

  it('cada grupo enlaza exactamente a las landings de su registro, con ancla servicio + ciudad', () => {
    const registries = [DESARROLLO_WEB_CITIES, LOCAL_AUTOMATION_CITIES, CONSULTORIA_CITIES];
    const prefixes = ['Desarrollo web', 'Automatización', 'Consultoría TI'];
    groups.forEach((g, i) => {
      const bySlug = new Map(registries[i].map((c) => [c.slug, c.city]));
      expect(g.links).toHaveLength(registries[i].length);
      for (const link of g.links) {
        const slug = link.href.replace(/^\//, '');
        expect(bySlug.has(slug), `slug fuera del registro: ${slug}`).toBe(true);
        expect(link.label).toBe(`${prefixes[i]} en ${bySlug.get(slug)}`);
      }
    });
  });

  it('suma 12 enlaces únicos', () => {
    const hrefs = groups.flatMap((g) => g.links.map((l) => l.href));
    expect(hrefs).toHaveLength(12);
    expect(new Set(hrefs).size).toBe(12);
  });
});

describe('getHomeGuideLinks — landings por keyword destacadas', () => {
  it('son ≤ 6, existen en el registro y ninguna es la variante Puerto Vallarta', () => {
    expect(HOME_FEATURED_KEYWORD_SLUGS.length).toBeLessThanOrEqual(6);
    for (const slug of HOME_FEATURED_KEYWORD_SLUGS) {
      const landing = getKeywordLanding(slug);
      expect(landing, `slug muerto: ${slug}`).toBeDefined();
      expect(landing!.city, `${slug} es variante local`).toBeUndefined();
    }
  });

  it('cubre los dos hubs y usa la keyword como ancla con inicial mayúscula', () => {
    const links = getHomeGuideLinks();
    expect(links).toHaveLength(HOME_FEATURED_KEYWORD_SLUGS.length);
    const hubs = new Set(HOME_FEATURED_KEYWORD_SLUGS.map((s) => getKeywordLanding(s)!.hub));
    expect(hubs).toEqual(new Set(['ecosistemas-web', 'automatizacion']));
    for (const link of links) {
      const landing = KEYWORD_LANDINGS.find((l) => `/${l.slug}` === link.href)!;
      expect(link.label).toBe(landing.keyword.charAt(0).toUpperCase() + landing.keyword.slice(1));
    }
  });
});
