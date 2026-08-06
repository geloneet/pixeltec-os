import { describe, it, expect } from 'vitest';
import {
  normalizeCandidate,
  validatePostForPublication,
  type PublicationCandidate,
} from './publication-gate';
import { EMPTY_EDITORIAL, EMPTY_SEO, type PostSource } from './types';

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

  it.each(['Admin', 'admin', 'Administrador'])('bloquea al autor genérico "%s" aunque tenga uid', (name) => {
    const v = validatePostForPublication(publishable({ author: { name, uid: 'uuid-real' } }));
    expect(v.ready).toBe(false);
    expect(v.blockers.map((b) => b.code)).toContain('author-generic');
  });

  it('un nombre real que contiene "admin" NO se bloquea', () => {
    const v = validatePostForPublication(publishable({ author: { name: 'Adminta Pérez', uid: 'uuid-real' } }));
    expect(v.blockers.map((b) => b.code)).not.toContain('author-generic');
  });

  it('bloquea un body que empieza con encabezado nivel 1 (doble H1)', () => {
    const v = validatePostForPublication(publishable({ body: '# Título repetido\n\n' + 'x'.repeat(600) }));
    expect(v.ready).toBe(false);
    expect(v.blockers.map((b) => b.code)).toContain('body-h1');
  });

  it('un body que empieza con "## Sección" NO se bloquea', () => {
    const v = validatePostForPublication(publishable({ body: '## Sección\n\n' + 'x'.repeat(600) }));
    expect(v.blockers.map((b) => b.code)).not.toContain('body-h1');
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

  const fuenteOficial: PostSource = {
    id: 's1',
    title: 'Precios de la Plataforma de WhatsApp Business',
    url: 'https://developers.facebook.com/docs/whatsapp/pricing',
    publisher: 'Meta',
    sourceType: 'official',
    claimSupported: 'Precios por conversación',
    accessedAt: '2026-08-04',
    verifiedByHuman: true,
  };

  it('advierte porcentajes en el body sin ninguna fuente', () => {
    const v = validatePostForPublication(
      publishable({ body: 'El 45% de las PyMEs pierde ventas por no contestar. ' + 'x'.repeat(600), sources: [] })
    );
    expect(v.ready).toBe(true); // warning, no blocker
    expect(v.warnings.map((w) => w.code)).toContain('stats-no-source');
  });

  it('porcentajes CON fuentes declaradas no generan el warning de cifras', () => {
    const v = validatePostForPublication(
      publishable({ body: 'El 45% de las PyMEs pierde ventas. ' + 'x'.repeat(600), sources: [fuenteOficial] })
    );
    expect(v.warnings.map((w) => w.code)).not.toContain('stats-no-source');
  });

  it('advierte CTA que promete agendar sesión/llamada de 30 minutos', () => {
    const v = validatePostForPublication(
      publishable({ body: 'x'.repeat(600) + ' Agenda una sesión de 30 minutos con nosotros.' })
    );
    expect(v.ready).toBe(true);
    expect(v.warnings.map((w) => w.code)).toContain('cta-promise');
  });

  it('"ahorra 30 minutos al día" NO dispara el warning de CTA', () => {
    const v = validatePostForPublication(
      publishable({ body: 'x'.repeat(600) + ' Con esto tu equipo ahorra 30 minutos al día.' })
    );
    expect(v.warnings.map((w) => w.code)).not.toContain('cta-promise');
  });

  it('advierte claims de plataforma (WhatsApp) sin fuente oficial/regulatoria', () => {
    const v = validatePostForPublication(
      publishable({ body: 'WhatsApp Business cobra por conversación. ' + 'x'.repeat(600), sources: [] })
    );
    expect(v.ready).toBe(true);
    expect(v.warnings.map((w) => w.code)).toContain('platform-no-official-source');
  });

  it('claims de plataforma CON fuente oficial no generan el warning', () => {
    const v = validatePostForPublication(
      publishable({ body: 'WhatsApp Business cobra por conversación. ' + 'x'.repeat(600), sources: [fuenteOficial] })
    );
    expect(v.warnings.map((w) => w.code)).not.toContain('platform-no-official-source');
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

describe('validatePostForPublication — sugerencias y anchors (B-PR4)', () => {
  it('suggestions SIEMPRE presente (array, [] cuando no aplica ninguna)', () => {
    const v = validatePostForPublication(
      publishable({
        excerpt: 'Un extracto largo de más de cien caracteres que aprovecha completo el espacio del snippet en resultados.',
        tags: ['ia', 'automatización'],
      })
    );
    expect(Array.isArray(v.suggestions)).toBe(true);
    expect(v.suggestions).toEqual([]);
  });

  it('excerpt-short: extracto <100 chars sugiere alargarlo (con anchor a excerpt)', () => {
    const v = validatePostForPublication(publishable({ tags: ['ia'] }));
    const s = v.suggestions.find((x) => x.code === 'excerpt-short');
    expect(s).toBeDefined();
    expect(s?.anchor).toEqual({ field: 'excerpt' });
  });

  it('few-headings: cuerpo >800 palabras con <2 "## " sugiere subtítulos', () => {
    const v = validatePostForPublication(publishable({ body: 'palabra '.repeat(900) }));
    const s = v.suggestions.find((x) => x.code === 'few-headings');
    expect(s).toBeDefined();
    expect(s?.anchor).toEqual({ field: 'body' });
  });

  it('few-headings NO aplica con 2+ H2 aunque el cuerpo sea largo', () => {
    const v = validatePostForPublication(
      publishable({ body: '## Uno\n\n' + 'palabra '.repeat(900) + '\n\n## Dos\n\nfin' })
    );
    expect(v.suggestions.map((s) => s.code)).not.toContain('few-headings');
  });

  it('tags-missing: sin etiquetas sugiere añadirlas; con etiquetas no', () => {
    const sin = validatePostForPublication(publishable({ tags: [] }));
    expect(sin.suggestions.map((s) => s.code)).toContain('tags-missing');
    const con = validatePostForPublication(publishable({ tags: ['ia'] }));
    expect(con.suggestions.map((s) => s.code)).not.toContain('tags-missing');
  });

  it('las sugerencias NUNCA afectan ready ni reclasifican blockers/warnings', () => {
    const v = validatePostForPublication(publishable({ tags: [] })); // fuerza tags-missing
    expect(v.suggestions.length).toBeGreaterThan(0);
    expect(v.ready).toBe(true);
    expect(v.blockers).toEqual([]);
  });

  it('los blockers de campo llevan anchor.field hacia el editor', () => {
    const v = validatePostForPublication(
      publishable({ title: 'corto', excerpt: 'x', body: 'x', slug: 'Slug Malo!' })
    );
    const byCode = Object.fromEntries(v.blockers.map((b) => [b.code, b.anchor?.field]));
    expect(byCode.title).toBe('title');
    expect(byCode.excerpt).toBe('excerpt');
    expect(byCode.body).toBe('body');
    expect(byCode.slug).toBe('slug');
  });

  it('cover/canonical/sources anclan a coverImage/canonicalUrl/sources', () => {
    const v = validatePostForPublication(
      publishable({
        coverImage: 'https://placehold.co/1200x630',
        seo: { ...EMPTY_SEO, noindex: false, canonicalUrl: '/relativa' },
        sources: [
          {
            id: 's1',
            title: 'Fuente sin verificar',
            url: 'https://example.com',
            publisher: 'X',
            sourceType: 'reputable-secondary',
            claimSupported: '',
            accessedAt: '2026-08-05',
            verifiedByHuman: false,
          },
        ],
      })
    );
    const byCode = Object.fromEntries(v.blockers.map((b) => [b.code, b.anchor?.field]));
    expect(byCode.cover).toBe('coverImage');
    expect(byCode.canonical).toBe('canonicalUrl');
    expect(byCode.sources).toBe('sources');
  });

  it('warnings de SEO/reviewer/enlaces llevan anchor.field', () => {
    const v = validatePostForPublication(
      publishable({
        seo: { ...EMPTY_SEO, noindex: false },
        editorial: { ...EMPTY_EDITORIAL, reviewedAt: '2026-08-03T00:00:00.000Z' },
      })
    );
    const byCode = Object.fromEntries(v.warnings.map((w) => [w.code, w.anchor?.field]));
    expect(byCode['meta-title']).toBe('seo.metaTitle');
    expect(byCode['meta-description']).toBe('seo.metaDescription');
    expect(byCode.keyword).toBe('seo.primaryKeyword');
    expect(byCode.reviewer).toBe('editorial.reviewerId');
    expect(byCode['internal-links']).toBe('internalLinks');
  });

  it('cta-promise ancla al body con el fragmento REAL matcheado (~60 chars)', () => {
    const v = validatePostForPublication(
      publishable({ body: 'x'.repeat(600) + ' Agenda una sesión de 30 minutos con nosotros.' })
    );
    const w = v.warnings.find((x) => x.code === 'cta-promise');
    expect(w?.anchor?.field).toBe('body');
    expect(w?.anchor?.excerpt).toBeDefined();
    expect(w!.anchor!.excerpt!.length).toBeLessThanOrEqual(60);
    // El fragmento existe literalmente en el cuerpo (deep-link seleccionable).
    expect(('x'.repeat(600) + ' Agenda una sesión de 30 minutos con nosotros.').includes(w!.anchor!.excerpt!)).toBe(true);
  });

  it('stats-no-source y platform-no-official-source anclan al body con excerpt', () => {
    const body = 'El 45% de las PyMEs usa WhatsApp Business a diario. ' + 'x'.repeat(600);
    const v = validatePostForPublication(publishable({ body, sources: [] }));
    const stats = v.warnings.find((x) => x.code === 'stats-no-source');
    const platform = v.warnings.find((x) => x.code === 'platform-no-official-source');
    expect(stats?.anchor?.field).toBe('body');
    expect(body.includes(stats!.anchor!.excerpt!)).toBe(true);
    expect(platform?.anchor?.field).toBe('body');
    expect(body.includes(platform!.anchor!.excerpt!)).toBe(true);
  });

  it('normalizeCandidate arrastra tags (y default []) para tags-missing', () => {
    const base = {
      status: 'approved',
      title: 'Título largo suficiente para el gate',
      excerpt: 'Extracto suficientemente largo para pasar el mínimo del gate sin ningún problema.',
      body: 'x'.repeat(600),
      slug: 'con-tags',
      coverImage: null,
      author: { name: 'Miguel', uid: 'u1' },
      seo: {},
      editorial: null,
      sources: null,
      internalLinks: undefined,
      ai: {},
    };
    expect(normalizeCandidate({ ...base, tags: ['ia'] }).tags).toEqual(['ia']);
    expect(normalizeCandidate(base).tags).toEqual([]);
  });
});
