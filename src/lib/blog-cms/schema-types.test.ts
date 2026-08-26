import { describe, it, expect } from 'vitest';
import {
  BLOG_SCHEMA_TYPES,
  BLOG_AUTOMATIC_SCHEMA_TYPES,
  isBlogSchemaType,
  selectableBlogSchemaTypes,
  sanitizeBlogSchemaTypes,
  buildExtraSchemaNodes,
} from './schema-types';

/**
 * WO-2026-00088 FASE 11 — pestaña «Snippets» (paridad Encino).
 * Estos tests fijan el contrato que se perdió al no portar la pestaña: catálogo
 * cerrado, saneado defensivo y JSON-LD mínimo por tipo.
 */
describe('catálogo de tipos', () => {
  it('conserva el placeholder vacío de Encino y no lo trata como tipo válido', () => {
    expect(BLOG_SCHEMA_TYPES[0]).toEqual({ value: '', label: '— Sin schema —' });
    expect(isBlogSchemaType('')).toBe(false);
  });

  it('no ofrece como «adicional» ningún tipo que la entrada ya emite sola', () => {
    const selectable = selectableBlogSchemaTypes().map((t) => t.value);
    for (const automatic of BLOG_AUTOMATIC_SCHEMA_TYPES) {
      expect(selectable).not.toContain(automatic);
    }
    expect(selectable).not.toContain('');
  });

  it('mantiene los tipos de la galería de Google que ofrecía Encino', () => {
    const values = BLOG_SCHEMA_TYPES.map((t) => t.value);
    for (const t of ['Product', 'Event', 'Recipe', 'VideoObject', 'LocalBusiness', 'JobPosting']) {
      expect(values).toContain(t);
    }
  });
});

describe('sanitizeBlogSchemaTypes', () => {
  it('acepta el formato legado de un solo string', () => {
    expect(sanitizeBlogSchemaTypes('Product')).toEqual(['Product']);
  });

  it('descarta vacíos, desconocidos y duplicados', () => {
    expect(sanitizeBlogSchemaTypes(['Product', '', 'Product', 'NoExiste', 'Event'])).toEqual(['Product', 'Event']);
  });

  it('devuelve [] ante basura', () => {
    for (const v of [null, undefined, 42, {}, [1, 2, 3]]) {
      expect(sanitizeBlogSchemaTypes(v)).toEqual([]);
    }
  });

  it('recorta a 10 tipos', () => {
    const many = selectableBlogSchemaTypes().map((t) => t.value);
    expect(many.length).toBeGreaterThan(10);
    expect(sanitizeBlogSchemaTypes(many)).toHaveLength(10);
  });
});

describe('buildExtraSchemaNodes', () => {
  const post = { title: 'Cómo elegir tu stack', url: 'https://pixeltec.mx/blog/como-elegir-tu-stack' };

  it('emite un nodo mínimo por tipo, como el SchemaInjector de Encino', () => {
    expect(buildExtraSchemaNodes(['Product'], post)).toEqual([
      { '@context': 'https://schema.org', '@type': 'Product', name: post.title, url: post.url },
    ]);
  });

  it('no emite nada cuando no hay tipos elegidos', () => {
    expect(buildExtraSchemaNodes([], post)).toEqual([]);
  });

  it('sanea antes de emitir: un tipo inventado nunca llega al JSON-LD', () => {
    expect(buildExtraSchemaNodes(['<script>', 'Event'], post).map((n) => n['@type'])).toEqual(['Event']);
  });
});
