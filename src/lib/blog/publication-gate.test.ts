import { describe, it, expect } from 'vitest';
import {
  normalizeCandidate,
  validatePostForPublication,
  type PublicationCandidate,
} from './publication-gate';
import { EMPTY_EDITORIAL, EMPTY_SEO } from './types';

/** Candidato publicable de referencia — cada test rompe UNA cosa. */
function publishable(overrides: Partial<PublicationCandidate> = {}): PublicationCandidate {
  return {
    status: 'approved',
    title: 'Un título perfectamente razonable para un artículo',
    excerpt: 'Un extracto suficientemente largo para alimentar la metadescripción del artículo publicado.',
    body: 'x'.repeat(600),
    slug: 'un-titulo-razonable',
    coverImage: null,
    author: { name: 'Miguel Robles', uid: 'uuid-autor' },
    seo: { ...EMPTY_SEO, noindex: false, metaTitle: 'Meta título', metaDescription: 'Meta descripción del artículo.' },
    editorial: { ...EMPTY_EDITORIAL, reviewerId: 'uuid-revisor', reviewedAt: '2026-08-03T00:00:00.000Z' },
    sources: [],
    internalLinks: [],
    ai: { model: 'claude', editedByHuman: true },
    ...overrides,
  };
}

describe('validatePostForPublication — blockers', () => {
  it('un candidato completo y aprobado es publicable', () => {
    const v = validatePostForPublication(publishable());
    expect(v.blockers).toEqual([]);
    expect(v.ready).toBe(true);
  });

  it('un draft NO se publica aunque la llamada llegue directa (P0-2)', () => {
    const v = validatePostForPublication(publishable({ status: 'draft' }));
    expect(v.ready).toBe(false);
    expect(v.blockers.map((b) => b.code)).toContain('status');
  });

  it('published se admite (re-publicación idempotente)', () => {
    expect(validatePostForPublication(publishable({ status: 'published' })).ready).toBe(true);
  });

  it.each([
    ['title', { title: 'corto' }],
    ['excerpt', { excerpt: 'muy corto' }],
    ['body', { body: 'x'.repeat(100) }],
    ['slug', { slug: 'Slug Inválido!' }],
  ] as const)('bloquea por %s inválido', (code, override) => {
    const v = validatePostForPublication(publishable(override as Partial<PublicationCandidate>));
    expect(v.ready).toBe(false);
    expect(v.blockers.map((b) => b.code)).toContain(code);
  });

  it('bloquea al autor anónimo "Admin" sin uid', () => {
    const v = validatePostForPublication(publishable({ author: { name: 'Admin', uid: '' } }));
    expect(v.blockers.map((b) => b.code)).toContain('author');
  });

  it('bloquea portada de placeholder externo', () => {
    const v = validatePostForPublication(
      publishable({ coverImage: 'https://placehold.co/1200x630/0a0a0a/ffffff?text=X' })
    );
    expect(v.blockers.map((b) => b.code)).toContain('cover');
  });

  it('bloquea canonical relativa', () => {
    const v = validatePostForPublication(
      publishable({ seo: { ...EMPTY_SEO, noindex: false, canonicalUrl: '/blog/otro' } })
    );
    expect(v.blockers.map((b) => b.code)).toContain('canonical');
  });

  it('bloquea fuentes declaradas sin verificación humana', () => {
    const v = validatePostForPublication(
      publishable({
        sources: [
          {
            id: 's1',
            title: 'Documentación oficial de Next.js',
            url: 'https://nextjs.org/docs',
            publisher: 'Vercel',
            sourceType: 'technical-documentation',
            claimSupported: 'ISR revalida bajo demanda',
            accessedAt: '2026-08-03',
            verifiedByHuman: false,
          },
        ],
      })
    );
    expect(v.blockers.map((b) => b.code)).toContain('sources');
  });

  it('bloquea IA pura sin edición NI revisión humana', () => {
    const v = validatePostForPublication(
      publishable({
        ai: { model: 'claude', editedByHuman: false },
        editorial: { ...EMPTY_EDITORIAL, reviewedAt: null },
      })
    );
    expect(v.blockers.map((b) => b.code)).toContain('human-review');
  });

  it('IA sin edición pero CON revisión registrada sí pasa', () => {
    const v = validatePostForPublication(
      publishable({
        ai: { model: 'claude', editedByHuman: false },
        editorial: { ...EMPTY_EDITORIAL, reviewedAt: '2026-08-03T00:00:00.000Z' },
      })
    );
    expect(v.blockers.map((b) => b.code)).not.toContain('human-review');
  });
});

describe('validatePostForPublication — warnings (no bloquean)', () => {
  it('sin metaTitle/metaDescription/keyword/cover/reviewer → warnings, ready=true', () => {
    const v = validatePostForPublication(
      publishable({
        seo: { ...EMPTY_SEO, noindex: false },
        editorial: { ...EMPTY_EDITORIAL, reviewedAt: '2026-08-03T00:00:00.000Z' },
      })
    );
    expect(v.ready).toBe(true);
    const codes = v.warnings.map((w) => w.code);
    expect(codes).toEqual(
      expect.arrayContaining(['meta-title', 'meta-description', 'cover-generic', 'reviewer', 'keyword', 'internal-links'])
    );
  });

  it('noindex solo advierte cuando el post YA está publicado con la bandera', () => {
    const draft = validatePostForPublication(
      publishable({ seo: { ...EMPTY_SEO, noindex: true, metaTitle: 't', metaDescription: 'd' } })
    );
    expect(draft.ready).toBe(true);
    expect(draft.warnings.map((w) => w.code)).not.toContain('noindex'); // default de borrador = ruido

    const republicacion = validatePostForPublication(
      publishable({ status: 'published', seo: { ...EMPTY_SEO, noindex: true, metaTitle: 't', metaDescription: 'd' } })
    );
    expect(republicacion.warnings.map((w) => w.code)).toContain('noindex');
  });

  it('sin conteo de palabras obligatorio: un body de 500+ no genera warning de longitud', () => {
    const v = validatePostForPublication(publishable());
    expect(v.warnings.map((w) => w.code)).not.toContain('word-count');
  });
});

describe('normalizeCandidate — filas viejas (JSONB {}/[] o null)', () => {
  it('rellena defaults sin lanzar y no exige revisión humana a posts manuales', () => {
    const candidate = normalizeCandidate({
      status: 'published',
      title: 'Post histórico anterior a WS2 con su título largo',
      excerpt: 'Extracto histórico suficientemente largo para pasar el mínimo del gate sin problema.',
      body: 'x'.repeat(600),
      slug: 'post-historico',
      coverImage: null,
      author: { name: 'Miguel', uid: 'u1' },
      seo: {},
      editorial: null,
      sources: null,
      internalLinks: undefined,
      ai: {},
    });
    expect(candidate.editorial.reviewerId).toBeNull();
    expect(candidate.sources).toEqual([]);
    expect(candidate.seo.noindex).toBe(true); // default seguro de borrador
    const v = validatePostForPublication(candidate);
    // Fila vieja sin ai.model → no es borrador IA → sin blocker de revisión.
    expect(v.blockers.map((b) => b.code)).not.toContain('human-review');
  });
});
