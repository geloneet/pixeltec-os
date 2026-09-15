import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { OrganizationStructuredData, ORG_ID, WEBSITE_ID } from './structured-data';
import { SITE } from '@/lib/site-config';
import { SERVED_CITY_NAMES } from '@/lib/content/services-catalog';

type Node = Record<string, unknown>;

function graphOf(html: string): Node[] {
  const scripts = html.match(/<script type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/g) ?? [];
  expect(scripts, 'un solo <script ld+json>').toHaveLength(1);
  const raw = /<script[^>]*>([\s\S]*?)<\/script>/.exec(scripts[0] ?? '')?.[1] ?? '';
  const parsed = JSON.parse(raw) as { '@context': string; '@graph': Node[] };
  expect(parsed['@context']).toBe('https://schema.org');
  return parsed['@graph'];
}

/**
 * L1 (WO-2026-00345): la única entidad local del sitio es `#organization`,
 * tipada Organization + ProfessionalService, con NAP completo y leída
 * íntegramente de `site-config` (sin listas paralelas de ciudades).
 */
describe('OrganizationStructuredData — Organization + ProfessionalService (SSR)', () => {
  const html = renderToStaticMarkup(<OrganizationStructuredData />);
  const graph = graphOf(html);
  const org = graph[0];
  const site = graph[1];

  it('emite exactamente 2 nodos: la organización y el sitio', () => {
    expect(graph).toHaveLength(2);
    expect(org['@id']).toBe('https://pixeltec.mx/#organization');
    expect(org['@id']).toBe(ORG_ID);
    expect(site['@id']).toBe(WEBSITE_ID);
  });

  it('la organización es a la vez Organization y ProfessionalService', () => {
    expect(org['@type']).toEqual(['Organization', 'ProfessionalService']);
  });

  it('publica el teléfono a nivel raíz Y en contactPoint, y el correo', () => {
    expect(org.telephone).toBe(SITE.phone.schema);
    expect(org.email).toBe(SITE.email);
    const cp = org.contactPoint as Record<string, unknown>;
    expect(cp['@type']).toBe('ContactPoint');
    expect(cp.telephone).toBe(SITE.phone.schema);
  });

  it('la dirección es la localidad documentada; streetAddress solo si site-config la declara', () => {
    const address = org.address as Record<string, unknown>;
    expect(address['@type']).toBe('PostalAddress');
    expect(address.addressLocality).toBe(SITE.address.locality);
    expect(address.addressRegion).toBe(SITE.address.region);
    expect(address.addressCountry).toBe(SITE.address.country);
    const street = (SITE.address as { street?: string }).street;
    if (street) expect(address.streetAddress).toBe(street);
    else expect(address).not.toHaveProperty('streetAddress');
    // Sin horario público documentado no se inventa uno.
    expect(org).not.toHaveProperty('openingHours');
    expect(org).not.toHaveProperty('openingHoursSpecification');
  });

  it('areaServed = las ciudades servidas (mismo orden que el catálogo) + México', () => {
    const area = org.areaServed as { '@type': string; name: string }[];
    expect(area.filter((a) => a['@type'] === 'City').map((a) => a.name)).toEqual([...SERVED_CITY_NAMES]);
    expect(area).toHaveLength(SERVED_CITY_NAMES.length + 1);
    expect(area.at(-1)).toEqual({ '@type': 'Country', name: 'Mexico' });
  });

  it('sameAs son exactamente los perfiles verificados de site-config (sin inventar redes)', () => {
    expect(org.sameAs).toEqual([...SITE.socialProfiles]);
    expect(SITE.socialProfiles).toHaveLength(2);
  });

  it('el fundador enlaza a /equipo; logo e imagen son URLs absolutas', () => {
    const founder = org.founder as Record<string, unknown>;
    expect(founder['@type']).toBe('Person');
    expect(founder.name).toBe(SITE.founder);
    expect(founder.url).toBe('https://pixeltec.mx/equipo');
    expect(org.logo).toMatch(/^https:\/\/pixeltec\.mx\//);
    expect(org.image).toMatch(/^https:\/\/pixeltec\.mx\//);
  });

  it('la description es la vigente de site-config, ≤ 300 chars, sin la frase vieja', () => {
    expect(org.description).toBe(SITE.description);
    expect(SITE.description.length).toBeLessThanOrEqual(300);
    expect(SITE.description).not.toContain('ecosistemas web y automatizaciones escalables');
    expect(SITE.description).toContain('Puerto Vallarta');
  });

  it('hasMap apunta a la ficha de Google Business Profile y no hay coordenadas (L6, WO-2026-00346)', () => {
    expect(org.hasMap).toBe('https://maps.app.goo.gl/fAiYRnLg53tx6VRF7');
    expect(org.hasMap).toBe(SITE.googleBusinessProfile.url);
    expect(org).not.toHaveProperty('geo');
    expect(org).not.toHaveProperty('aggregateRating');
  });

  it('el WebSite sigue intacto y apunta a la organización como publisher', () => {
    expect(site['@type']).toBe('WebSite');
    expect(site.url).toBe(SITE.url);
    expect(site.publisher).toEqual({ '@id': ORG_ID });
  });
});
