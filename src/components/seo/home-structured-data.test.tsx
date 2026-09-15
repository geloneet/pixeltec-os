import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { HomeStructuredData, buildHomeGraph } from './home-structured-data';
import { ORG_ID } from './structured-data';
import { SERVED_CITY_NAMES, SERVICES_CATALOG } from '@/lib/content/services-catalog';

type Node = Record<string, unknown> & { '@type': string };

function graphOf(html: string): Node[] {
  const m = /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  expect(m, 'debe haber un solo <script ld+json>').not.toBeNull();
  const parsed = JSON.parse(m![1]) as { '@context': string; '@graph': Node[] };
  expect(parsed['@context']).toBe('https://schema.org');
  return parsed['@graph'];
}

describe('HomeStructuredData — Service ×3 + ItemList en un solo @graph (SSR)', () => {
  const html = renderToStaticMarkup(<HomeStructuredData />);
  const graph = graphOf(html);

  it('emite un único script y no repite Organization/WebSite del layout', () => {
    expect((html.match(/<script/g) ?? []).length).toBe(1);
    expect(graph.map((n) => n['@type'])).toEqual(['ItemList', 'Service', 'Service', 'Service']);
  });

  it('no emite BreadcrumbList ni LocalBusiness (decisión de Miguel 2026-09-14)', () => {
    expect(graph.map((n) => n['@type'])).not.toContain('BreadcrumbList');
    expect(graph.map((n) => n['@type'])).not.toContain('LocalBusiness');
  });

  it('cada Service apunta a su página, a la Organization y a las ciudades servidas', () => {
    const services = graph.filter((n) => n['@type'] === 'Service');
    for (const [i, s] of services.entries()) {
      const entry = SERVICES_CATALOG[i];
      expect(s['@id']).toBe(`https://pixeltec.mx/services/${entry.slug}#service`);
      expect(s.url).toBe(`https://pixeltec.mx/services/${entry.slug}`);
      expect(s.name).toBe(entry.name);
      expect(s.provider).toEqual({ '@id': ORG_ID });
      const area = s.areaServed as { '@type': string; name: string }[];
      expect(area.filter((a) => a['@type'] === 'City').map((a) => a.name)).toEqual([...SERVED_CITY_NAMES]);
      expect(area.at(-1)).toEqual({ '@type': 'Country', name: 'Mexico' });
    }
  });

  it('el ItemList enlaza los tres @id en orden', () => {
    const list = graph[0] as Node & { itemListElement: { position: number; item: { '@id': string } }[] };
    expect(list.numberOfItems).toBe(3);
    expect(list.itemListElement.map((e) => e.item['@id'])).toEqual(
      SERVICES_CATALOG.map((e) => `https://pixeltec.mx/services/${e.slug}#service`),
    );
  });

  it('buildHomeGraph es determinista y las ciudades siguen el orden de cobertura', () => {
    expect(buildHomeGraph()).toEqual(buildHomeGraph());
    expect(SERVED_CITY_NAMES).toEqual(['Puerto Vallarta', 'Bahía de Banderas', 'Guadalajara', 'Zapopan']);
  });
});
