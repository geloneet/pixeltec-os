import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { IndustryHubStructuredData, IndustryStructuredData, buildIndustryServiceGraph, industryServiceId } from './industry-structured-data';
import { ORG_ID } from './structured-data';
import { SERVED_CITY_NAMES } from '@/lib/content/services-catalog';
import { industriesWithPage } from '@/lib/content/industrias';

type Node = Record<string, unknown> & { '@type': string };

function graphOf(html: string): Node[] {
  const scripts = html.match(/<script type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/g) ?? [];
  expect(scripts, 'un solo <script ld+json>').toHaveLength(1);
  const raw = /<script[^>]*>([\s\S]*?)<\/script>/.exec(scripts[0] ?? '')?.[1] ?? '';
  const parsed = JSON.parse(raw) as { '@context': string; '@graph': Node[] };
  expect(parsed['@context']).toBe('https://schema.org');
  return parsed['@graph'];
}

describe('IndustryStructuredData — un Service por página de industria', () => {
  for (const industry of industriesWithPage()) {
    it(`${industry.page.slug}: Service con provider, audience y ciudades; sin Organization`, () => {
      const graph = graphOf(renderToStaticMarkup(<IndustryStructuredData industry={industry} />));
      expect(graph.map((n) => n['@type'])).toEqual(['Service']);
      const service = graph[0];
      expect(service['@id']).toBe(`https://pixeltec.mx/industrias/${industry.page.slug}#service`);
      expect(service['@id']).toBe(industryServiceId(industry.page));
      expect(service.url).toBe(`https://pixeltec.mx/industrias/${industry.page.slug}`);
      expect(service.name).toBe(industry.page.h1);
      expect(service.serviceType).toBe(industry.page.serviceType);
      expect(service.provider).toEqual({ '@id': ORG_ID });
      expect(service.audience).toEqual({ '@type': 'Audience', audienceType: industry.page.audienceType });
      const area = service.areaServed as { '@type': string; name: string }[];
      expect(area.filter((a) => a['@type'] === 'City').map((a) => a.name)).toEqual([...SERVED_CITY_NAMES]);
      expect(area.at(-1)).toEqual({ '@type': 'Country', name: 'Mexico' });
      for (const t of ['Organization', 'WebSite', 'LocalBusiness']) expect(JSON.stringify(graph)).not.toContain(`"${t}"`);
    });
  }

  it('buildIndustryServiceGraph es determinista', () => {
    const [first] = industriesWithPage();
    expect(buildIndustryServiceGraph(first)).toEqual(buildIndustryServiceGraph(first));
  });
});

describe('IndustryHubStructuredData — ItemList del hub', () => {
  it('lista SOLO las industrias con página, por @id del Service', () => {
    const graph = graphOf(renderToStaticMarkup(<IndustryHubStructuredData />));
    expect(graph.map((n) => n['@type'])).toEqual(['ItemList']);
    const list = graph[0] as Node & { itemListElement: { position: number; item: { '@id': string } }[]; numberOfItems: number };
    expect(list['@id']).toBe('https://pixeltec.mx/industrias#industrias');
    expect(list.numberOfItems).toBe(2);
    expect(list.itemListElement.map((e) => e.item['@id'])).toEqual(
      industriesWithPage().map((i) => `https://pixeltec.mx/industrias/${i.page.slug}#service`),
    );
    expect(list.itemListElement.map((e) => e.position)).toEqual([1, 2]);
  });
});
