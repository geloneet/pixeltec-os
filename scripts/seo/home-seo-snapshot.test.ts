import { describe, expect, it } from 'vitest';
import {
  visibleText,
  wordCount,
  countTerm,
  internalHrefs,
  classifyLinks,
  headingOutline,
  jsonLdTypes,
  landingSlugsFromSource,
} from './home-seo-snapshot.lib';

const HTML = `<html><head><title>T</title>
<script>var x = 1;</script>
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization"},{"@type":"WebSite"}]}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage","name":"Inicio"}</script>
<style>.a{opacity:0}</style></head>
<body><h1 class="x">Desarrollo Web y<br/><span>Automatización con IA</span></h1>
<p>Software a la medida en Puerto&nbsp;Vallarta &amp; Guadalajara. Automatización, automatización.</p>
<h2>Servicios</h2><h3>Desarrollo Web &amp; Apps</h3>
<a href="/desarrollo-web-guadalajara">A</a><a href="/desarrollo-web-guadalajara">B</a>
<a href="/services/automatizacion">C</a><a href="/blog#x">D</a><a href="/_next/static/x.js">E</a>
<a href="https://instagram.com/pixeltecmx">F</a><svg><title>icono</title></svg>
</body></html>`;

describe('visibleText / wordCount', () => {
  it('quita scripts, estilos, svg y etiquetas; decodifica entidades básicas', () => {
    const text = visibleText(HTML);
    expect(text).not.toContain('var x');
    expect(text).not.toContain('opacity');
    expect(text).not.toContain('icono');
    expect(text).toContain('Puerto Vallarta & Guadalajara');
    expect(text).toContain('Desarrollo Web y Automatización con IA');
  });
  it('cuenta palabras con letras o números, no signos sueltos', () => {
    expect(wordCount('Hola, mundo — 2026 &')).toBe(3);
  });
});

describe('countTerm', () => {
  const text = visibleText(HTML);
  it('es insensible a mayúsculas y acentos y respeta límites de palabra', () => {
    expect(countTerm(text, 'automatización')).toBe(3);
    expect(countTerm(text, 'AUTOMATIZACION')).toBe(3);
    expect(countTerm(text, 'desarrollo web')).toBe(2);
    expect(countTerm(text, 'IA')).toBe(1);
    expect(countTerm(text, 'medida')).toBe(1);
  });
});

describe('internalHrefs / classifyLinks', () => {
  it('conserva solo rutas internas de contenido, sin hash ni assets', () => {
    expect(internalHrefs(HTML)).toEqual([
      '/desarrollo-web-guadalajara',
      '/desarrollo-web-guadalajara',
      '/services/automatizacion',
      '/blog',
    ]);
  });
  it('clasifica landings por primer segmento', () => {
    const out = classifyLinks(internalHrefs(HTML), new Set(['desarrollo-web-guadalajara', 'automatizacion-zapopan']));
    expect(out).toEqual({ total: 4, unique: 3, landing: 1, landingHrefs: ['/desarrollo-web-guadalajara'] });
  });
});

describe('headingOutline / jsonLdTypes', () => {
  it('extrae el outline sin etiquetas internas', () => {
    expect(headingOutline(HTML)).toEqual([
      { level: 1, text: 'Desarrollo Web y Automatización con IA' },
      { level: 2, text: 'Servicios' },
      { level: 3, text: 'Desarrollo Web & Apps' },
    ]);
  });
  it('lista los @type de raíz y de @graph, en orden', () => {
    expect(jsonLdTypes(HTML)).toEqual(['Organization', 'WebSite', 'WebPage']);
  });
});

describe('landingSlugsFromSource', () => {
  it('lee los slugs de los registros con el mismo regex que gen-keyword-landing-pages.mjs', () => {
    const src = `export const X = [{ slug: 'automatizacion-guadalajara', city: 'Guadalajara' }, { slug: 'desarrollo-de-app', keyword: 'x' }];`;
    expect([...landingSlugsFromSource([src])]).toEqual(['automatizacion-guadalajara', 'desarrollo-de-app']);
  });
});
