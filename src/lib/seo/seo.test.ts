import { describe, it, expect } from 'vitest';
import { SEO_TOOLS, getSeoTool, isSeoToolKey, validateToolContent, allSeoSettingKeys } from './tools';
import {
  SITE_PAGES,
  getSitePage,
  normalizeSchemaPath,
  parsePageSchemaMap,
  serializePageSchemaMap,
  schemaNodesForPath,
} from './page-schema';
import {
  MAX_REASON_LENGTH,
  SUGGEST_SYSTEM,
  buildSuggestPrompt,
  normalizeSuggestions,
  suggestableSchemaTypes,
} from './page-schema-suggest';
import {
  DEFAULT_SOCIAL_LINKS,
  isValidSocialHref,
  parseSocialLinks,
  serializeSocialLinks,
  visibleSocialLinks,
} from './social';
import { buildHealthChecks, summarizeHealth, type SeoSnapshot } from './health';
import { reconcileRobots } from './robots';
import { PROTECTED_PATHS } from '@/lib/routes/admin-routes';

/** WO-2026-00095 — módulo SEO portado de Muebles Encino, solo pixeltec.mx. */

describe('catálogo de herramientas', () => {
  it('tiene las cuatro herramientas de Encino y claves de ajuste únicas', () => {
    expect(Object.keys(SEO_TOOLS).sort()).toEqual(['llms', 'local-business', 'robots', 'structured-data']);
    const keys = allSeoSettingKeys();
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('reconoce sus claves y rechaza las ajenas', () => {
    expect(isSeoToolKey('robots')).toBe(true);
    expect(isSeoToolKey('inventada')).toBe(false);
    expect(getSeoTool('inventada')).toBeNull();
  });

  it('valida JSON solo en las herramientas de formato JSON', () => {
    expect(validateToolContent(SEO_TOOLS.robots, 'no soy json')).toBeNull();
    expect(validateToolContent(SEO_TOOLS['structured-data'], '{"@type":"Organization"}')).toBeNull();
    expect(validateToolContent(SEO_TOOLS['structured-data'], '{roto')).toMatch(/JSON válido/);
    // Vacío no es un error: es «todavía no lo he escrito».
    expect(validateToolContent(SEO_TOOLS['structured-data'], '   ')).toBeNull();
  });
});

describe('schema por página', () => {
  it('normaliza rutas a la forma canónica', () => {
    expect(normalizeSchemaPath('/blog/')).toBe('/blog');
    expect(normalizeSchemaPath('/')).toBe('/');
    expect(normalizeSchemaPath('')).toBe('/');
    expect(normalizeSchemaPath('/contact?x=1#y')).toBe('/contact');
  });

  it('lee el formato de un solo tipo y el de lista', () => {
    expect(parsePageSchemaMap('{"/contact":"LocalBusiness"}')).toEqual({ '/contact': ['LocalBusiness'] });
    expect(parsePageSchemaMap('{"/":["Organization","WebPage"]}')).toEqual({ '/': ['Organization', 'WebPage'] });
  });

  it('devuelve {} ante JSON roto o formas inesperadas', () => {
    for (const raw of ['{roto', '[]', 'null', '', null, undefined]) {
      expect(parsePageSchemaMap(raw)).toEqual({});
    }
  });

  it('al serializar descarta rutas fuera del catálogo y tipos inventados', () => {
    const out = JSON.parse(
      serializePageSchemaMap({ '/contact': ['Organization', 'NoExiste'], '/ruta-inventada': ['Organization'] }),
    );
    expect(out).toEqual({ '/contact': ['Organization'] });
  });

  it('el catálogo de páginas no tiene rutas duplicadas', () => {
    const paths = SITE_PAGES.map((p) => p.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('toda página del catálogo describe de qué trata (la IA solo lee eso)', () => {
    for (const page of SITE_PAGES) {
      expect(page.description.trim(), `«${page.path}» sin descripción`).not.toBe('');
      expect(page.description.trim().length, `«${page.path}» con descripción demasiado corta`).toBeGreaterThan(30);
    }
  });

  it('getSitePage encuentra la página normalizando la ruta', () => {
    expect(getSitePage('/contact/')?.label).toBe('Contacto');
    expect(getSitePage('/')?.label).toBe('Inicio');
    expect(getSitePage('/ruta-inventada')).toBeUndefined();
  });
});

/** WO-2026-00220 — «Sugerir con IA» del schema por página. */
describe('sugerencia de schema con IA', () => {
  const pages = SITE_PAGES.slice(0, 3);

  it('el catálogo ofrecido a la IA excluye los tipos que ya emite todo el sitio', () => {
    const values = suggestableSchemaTypes().map((t) => t.value);
    expect(values).not.toContain('Organization');
    expect(values).toContain('WebPage');
  });

  it('el prompt incluye todas las rutas pedidas y el catálogo permitido', () => {
    const prompt = buildSuggestPrompt(pages, { '/': ['WebPage'] });
    for (const page of pages) {
      expect(prompt).toContain(page.path);
      expect(prompt).toContain(page.label);
      expect(prompt).toContain(page.description);
    }
    expect(prompt).toContain('WebPage');
    expect(prompt).toContain(SITE_PAGES[0].path);
    // Los tipos ya asignados viajan para que no los repita.
    expect(prompt).toContain('Tipos ya asignados: WebPage');
  });

  it('el system prompt prohíbe los tipos que ya emite el sitio y exige solo JSON', () => {
    expect(SUGGEST_SYSTEM).toContain('Organization');
    expect(SUGGEST_SYSTEM).toContain('"suggestions"');
  });

  it('descarta tipos inventados y rutas que no se pidieron', () => {
    const out = normalizeSuggestions(
      {
        suggestions: [
          { path: '/contact', types: [{ type: 'NoExisteEsteTipo', reason: 'x' }, { type: 'LocalBusiness', reason: 'Aparece en el mapa' }] },
          { path: '/ruta-que-nadie-pidio', types: [{ type: 'WebPage', reason: 'x' }] },
        ],
      },
      ['/contact'],
      {},
    );
    expect(out).toEqual([
      { path: '/contact', types: [{ type: 'LocalBusiness', reason: 'Aparece en el mapa' }] },
    ]);
  });

  it('quita los tipos que la página ya tiene asignados', () => {
    const out = normalizeSuggestions(
      { suggestions: [{ path: '/contact', types: [{ type: 'LocalBusiness', reason: 'a' }, { type: 'WebPage', reason: 'b' }] }] },
      ['/contact'],
      { '/contact': ['LocalBusiness'] },
    );
    expect(out[0].types).toEqual([{ type: 'WebPage', reason: 'b' }]);
  });

  it('recorta a 3 tipos por página, deduplica y limita el motivo', () => {
    const out = normalizeSuggestions(
      {
        suggestions: [
          {
            path: '/services',
            types: [
              { type: 'WebPage', reason: 'a'.repeat(400) },
              { type: 'WebPage', reason: 'duplicado' },
              { type: 'Service', reason: 'b' },
              { type: 'ItemList', reason: 'c' },
              { type: 'QAPage', reason: 'd' },
            ],
          },
        ],
      },
      ['/services'],
      {},
    );
    expect(out[0].types.map((t) => t.type)).toEqual(['WebPage', 'Service', 'ItemList']);
    expect(out[0].types[0].reason.length).toBe(MAX_REASON_LENGTH);
  });

  it('devuelve una entrada vacía por cada ruta pedida sin sugerencias', () => {
    expect(normalizeSuggestions({ suggestions: [] }, ['/about', '/equipo'], {})).toEqual([
      { path: '/about', types: [] },
      { path: '/equipo', types: [] },
    ]);
  });

  it('ante una respuesta con forma inesperada devuelve listas vacías, no lanza', () => {
    for (const raw of [null, 'texto', { otraCosa: 1 }, { suggestions: 'no-es-lista' }]) {
      expect(normalizeSuggestions(raw, ['/about'], {})).toEqual([{ path: '/about', types: [] }]);
    }
  });

  it('emite un nodo mínimo por tipo de la ruta pedida', () => {
    const map = { '/contact': ['LocalBusiness'] };
    expect(schemaNodesForPath(map, '/contact/', { title: 'Contacto', url: 'https://pixeltec.mx/contact' })).toEqual([
      {
        '@context': 'https://schema.org',
        '@type': 'LocalBusiness',
        name: 'Contacto',
        url: 'https://pixeltec.mx/contact',
      },
    ]);
    expect(schemaNodesForPath(map, '/otra', { title: 'x', url: 'y' })).toEqual([]);
  });
});

describe('redes sociales', () => {
  it('solo acepta http(s)', () => {
    expect(isValidSocialHref('https://instagram.com/pixeltec')).toBe(true);
    expect(isValidSocialHref('javascript:alert(1)')).toBe(false);
    expect(isValidSocialHref('   ')).toBe(false);
  });

  it('completa el catálogo cuando faltan redes guardadas', () => {
    const links = parseSocialLinks('[{"label":"Instagram","href":"https://instagram.com/x","enabled":true}]');
    expect(links).toHaveLength(DEFAULT_SOCIAL_LINKS.length);
    expect(links.find((l) => l.label === 'Instagram')?.enabled).toBe(true);
  });

  it('al guardar apaga lo que no tiene URL válida', () => {
    const saved = JSON.parse(
      serializeSocialLinks([
        { label: 'Facebook', href: 'no-es-url', enabled: true },
        { label: 'Instagram', href: 'https://instagram.com/x', enabled: true },
      ]),
    );
    expect(saved.find((l: { label: string }) => l.label === 'Facebook').enabled).toBe(false);
    expect(saved.find((l: { label: string }) => l.label === 'Instagram').enabled).toBe(true);
  });

  it('solo publica las activas y válidas', () => {
    const links = parseSocialLinks(
      '[{"label":"X","href":"https://x.com/p","enabled":true},{"label":"TikTok","href":"","enabled":true}]',
    );
    expect(visibleSocialLinks(links).map((l) => l.label)).toEqual(['X']);
  });
});

describe('robots.txt publicado', () => {
  it('añade las rutas privadas que el archivo publicado no traiga', () => {
    const out = reconcileRobots('User-agent: *\nAllow: /');
    for (const p of PROTECTED_PATHS) expect(out).toContain(`Disallow: ${p}`);
    expect(out).toContain('Sitemap: https://pixeltec.mx/sitemap.xml');
  });

  it('no duplica lo que el archivo ya declara', () => {
    const withOne = `User-agent: *\nDisallow: ${PROTECTED_PATHS[0]}\nSitemap: https://pixeltec.mx/sitemap.xml`;
    const out = reconcileRobots(withOne);
    expect(out.match(new RegExp(`Disallow: ${PROTECTED_PATHS[0]}\\b`, 'g'))).toHaveLength(1);
    expect(out.match(/Sitemap:/g)).toHaveLength(1);
  });

  it('un archivo publicado NO puede dejar el panel abierto al rastreo', () => {
    // El caso que motiva la diferencia con Encino: una IA genera un robots.txt
    // permisivo y alguien lo guarda sin mirar.
    const out = reconcileRobots('User-agent: *\nAllow: /');
    expect(out).toContain('Disallow: /blog-cms');
    expect(out).toContain('Disallow: /seo');
  });
});

describe('salud SEO', () => {
  const base: SeoSnapshot = {
    llms: { enabled: false, hasContent: false },
    robots: { enabled: false, hasContent: false },
    localBusiness: { enabled: false, hasContent: false },
    structuredData: { enabled: false, hasContent: false },
    sitemapEnabled: true,
    pageSchemaCount: 0,
    socialCount: 0,
    blog: { published: 0, missingMetaDescription: 0 },
  };

  it('distingue «sin contenido» de «con contenido pero sin publicar»', () => {
    const off = buildHealthChecks(base).find((c) => c.id === 'llms');
    expect(off?.status).toBe('off');

    const warn = buildHealthChecks({ ...base, llms: { enabled: false, hasContent: true } }).find((c) => c.id === 'llms');
    expect(warn?.status).toBe('warn');

    const ok = buildHealthChecks({ ...base, llms: { enabled: true, hasContent: true } }).find((c) => c.id === 'llms');
    expect(ok?.status).toBe('ok');
  });

  it('avisa cuando faltan resúmenes en el blog', () => {
    const check = buildHealthChecks({ ...base, blog: { published: 5, missingMetaDescription: 2 } }).find(
      (c) => c.id === 'blog-meta',
    );
    expect(check?.status).toBe('warn');
    expect(check?.detail).toContain('2 de 5');
  });

  it('cada chequeo apunta a una pantalla del panel', () => {
    for (const check of buildHealthChecks(base)) expect(check.href).toMatch(/^\//);
  });

  it('el resumen cuadra con el número de chequeos', () => {
    const checks = buildHealthChecks(base);
    const t = summarizeHealth(checks);
    expect(t.ok + t.warn + t.off).toBe(checks.length);
  });
});
