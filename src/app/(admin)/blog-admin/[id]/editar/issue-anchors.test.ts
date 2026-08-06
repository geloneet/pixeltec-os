import { describe, expect, it } from 'vitest';
import { FIELD_ANCHORS, anchorTarget } from './issue-anchors';

describe('anchorTarget — deep-links del panel de publicación', () => {
  it('resuelve cada field conocido a su etapa y elemento', () => {
    expect(anchorTarget({ code: 'title', message: '', anchor: { field: 'title' } })).toEqual({
      stage: 'escribir',
      elementId: 'anchor-title',
    });
    expect(anchorTarget({ code: 'slug', message: '', anchor: { field: 'slug' } })).toEqual({
      stage: 'optimizar',
      elementId: 'anchor-slug',
    });
    expect(anchorTarget({ code: 'sources', message: '', anchor: { field: 'sources' } })).toEqual({
      stage: 'verificar',
      elementId: 'anchor-sources',
    });
  });

  it('los campos SEO comparten el ancla del panel SEO en Optimizar', () => {
    for (const field of ['seo.metaTitle', 'seo.metaDescription', 'seo.primaryKeyword', 'canonicalUrl']) {
      expect(anchorTarget({ code: 'x', message: '', anchor: { field } })).toEqual({
        stage: 'optimizar',
        elementId: 'anchor-seo',
      });
    }
  });

  it('issue sin anchor → fallback a Escribir sin elemento', () => {
    expect(anchorTarget({ code: 'status', message: '' })).toEqual({ stage: 'escribir' });
  });

  it('field desconocido → fallback a Escribir sin elemento', () => {
    expect(anchorTarget({ code: 'x', message: '', anchor: { field: 'campo-inventado' } })).toEqual({
      stage: 'escribir',
    });
  });

  it('todos los fields del mapa apuntan a etapas válidas y elementos con prefijo anchor-', () => {
    for (const [field, target] of Object.entries(FIELD_ANCHORS)) {
      expect(['escribir', 'optimizar', 'verificar'], field).toContain(target.stage);
      expect(target.elementId, field).toMatch(/^anchor-/);
    }
  });
});
