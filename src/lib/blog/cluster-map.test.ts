import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_RELATED_RESOURCES, RELATED_RESOURCES_BY_CATEGORY, relatedResourcesFor } from './cluster-map';
import { KEYWORD_LANDINGS } from '@/lib/content/keyword-landings';
import { DESARROLLO_WEB_CITIES, CONSULTORIA_CITIES } from '@/lib/content/local-services';
import { LOCAL_AUTOMATION_CITIES } from '@/lib/content/automatizacion-local';
import { industriesWithPage } from '@/lib/content/industrias';

/**
 * L3 (WO-2026-00345): todo artículo enlaza a un servicio y a una landing
 * aunque el editor no haya cargado `internalLinks`. El mapa es literal (sin
 * importar registros: viaja al bundle del cliente); este test comprueba que
 * cada destino existe de verdad.
 */
const STATIC_ROUTES = ['/services', '/services/ecosistemas-web', '/services/automatizacion', '/services/consultoria', '/pixelbot', '/diagnostico', '/industrias', '/contact'];
const EXISTING = new Set([
  ...STATIC_ROUTES,
  ...KEYWORD_LANDINGS.map((l) => `/${l.slug}`),
  ...DESARROLLO_WEB_CITIES.map((c) => `/${c.slug}`),
  ...CONSULTORIA_CITIES.map((c) => `/${c.slug}`),
  ...LOCAL_AUTOMATION_CITIES.map((c) => `/${c.slug}`),
  ...industriesWithPage().map((i) => `/industrias/${i.page.slug}`),
]);

describe('RELATED_RESOURCES_BY_CATEGORY', () => {
  it('cubre las 4 categorías reales del blog con 2–3 destinos existentes cada una', () => {
    expect(Object.keys(RELATED_RESOURCES_BY_CATEGORY).sort()).toEqual(['arquitectura', 'automatización', 'case-study', 'opinión']);
    for (const [category, links] of Object.entries(RELATED_RESOURCES_BY_CATEGORY)) {
      expect(links.length, category).toBeGreaterThanOrEqual(2);
      expect(links.length, category).toBeLessThanOrEqual(3);
      for (const l of links) {
        expect(EXISTING.has(l.href), `${category} → ${l.href}`).toBe(true);
        expect(l.anchor.length).toBeGreaterThan(5);
      }
      // Al menos un servicio o landing comercial por categoría (no solo herramientas).
      expect(links.some((l) => l.href.startsWith('/services') || !STATIC_ROUTES.includes(l.href))).toBe(true);
    }
    for (const l of DEFAULT_RELATED_RESOURCES) expect(EXISTING.has(l.href), l.href).toBe(true);
  });
});

describe('relatedResourcesFor', () => {
  it('devuelve los del mapa de la categoría, máximo 3', () => {
    const out = relatedResourcesFor('automatización', [], []);
    expect(out.length).toBeLessThanOrEqual(3);
    expect(out.map((l) => l.href)).toEqual(RELATED_RESOURCES_BY_CATEGORY['automatización'].map((l) => l.href));
  });

  it('no repite lo que el post ya trae en internalLinks', () => {
    const first = RELATED_RESOURCES_BY_CATEGORY['automatización'][0];
    const out = relatedResourcesFor('automatización', [], [{ targetUrl: first.href }]);
    expect(out.map((l) => l.href)).not.toContain(first.href);
    expect(new Set(out.map((l) => l.href)).size).toBe(out.length);
  });

  it('las etiquetas de WhatsApp empujan /pixelbot y la guía de WhatsApp Business al frente', () => {
    const out = relatedResourcesFor('opinión', ['WhatsApp', 'atención'], []);
    expect(out[0].href).toBe('/pixelbot');
    expect(out.map((l) => l.href)).toContain('/automatizar-whatsapp-business');
    expect(out.length).toBeLessThanOrEqual(3);
  });

  it('categoría desconocida o vacía → default (servicios + industrias)', () => {
    expect(relatedResourcesFor('inventada', [], []).map((l) => l.href)).toEqual(DEFAULT_RELATED_RESOURCES.map((l) => l.href));
    expect(relatedResourcesFor('', [], [])).toEqual(DEFAULT_RELATED_RESOURCES);
  });

  it('la sugerencia trae siempre al menos 2 enlaces si el post no trae ninguno', () => {
    for (const category of [...Object.keys(RELATED_RESOURCES_BY_CATEGORY), 'otra']) {
      expect(relatedResourcesFor(category, [], []).length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('blog-post-client.tsx — bloque «Recursos de PixelTEC mencionados» con fallback', () => {
  const src = readFileSync(resolve(__dirname, '..', '..', 'app', 'blog', '[slug]', 'blog-post-client.tsx'), 'utf8');

  it('usa relatedResourcesFor cuando el post no trae internalLinks y conserva el tracking', () => {
    expect(src).toMatch(/from ['"]@\/lib\/blog\/cluster-map['"]/);
    expect(src).toContain('relatedResourcesFor(');
    expect(src).toContain('data-cta="internal_link"');
    expect(src).toContain('Recursos de PixelTEC mencionados');
  });
});
