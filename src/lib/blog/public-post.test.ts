import { describe, it, expect } from 'vitest';
import { toPublicBlogPost, type PublicBlogPost } from './public-post';
import { EMPTY_EDITORIAL, EMPTY_SEO, type BlogPostSerialized } from './types';

// Canaries: valores únicos que JAMÁS deben cruzar al navegador.
const CANARY = {
  brief: 'CANARIO-BRIEF-a7f31',
  rawOutput: 'CANARIO-RAWOUTPUT-b8e42',
  reviewer: 'CANARIO-REVIEWER-c9d53',
  keyword: 'CANARIO-KEYWORD-d0c64',
  goal: 'CANARIO-GOAL-e1b75',
  unverifiedUrl: 'https://example.com/CANARIO-FUENTE-NO-VERIFICADA-f2a86',
  claimInterno: 'CANARIO-CLAIM-INTERNO-03997',
  placementInterno: 'CANARIO-PLACEMENT-g3h97',
  // WO-2026-00088 (paridad Encino): ai_params SÍ contiene el brief crudo del
  // wizard — es interno (igual que briefSource) y no debe cruzar al público.
  aiParamsBrief: 'CANARIO-AIPARAMS-BRIEF-h4i08',
};

function fullPost(): BlogPostSerialized {
  return {
    id: 'id-interno-xyz',
    slug: 'articulo-de-prueba',
    title: 'Artículo de prueba con canaries',
    excerpt: 'Extracto suficientemente largo para el tipo serializado del post.',
    body: 'Cuerpo público del artículo.',
    category: 'automatización',
    tags: ['prueba'],
    coverImage: '/covers/prueba.jpg',
    author: { name: 'Miguel Robles', uid: 'uid-interno-secreto' },
    status: 'published',
    briefSource: {
      topic: CANARY.brief,
      angle: 'ángulo interno',
      targetAudience: 'audiencia',
      keyPoints: ['punto'],
      tone: 'educativo',
      contentGoal: CANARY.goal,
      desiredAction: 'acción interna',
      primaryKeyword: CANARY.keyword,
    },
    ai: {
      model: 'claude',
      generatedAt: '2026-08-04T00:00:00.000Z',
      editedByHuman: true,
      wordsAdded: 0,
      iterations: 1,
      // rawOutput viaja como clave extra del JSONB en posts nuevos:
      ...( { rawOutput: CANARY.rawOutput } as object),
    },
    seo: {
      ...EMPTY_SEO,
      noindex: false,
      metaTitle: 'Meta título',
      metaDescription: 'Meta descripción',
      primaryKeyword: CANARY.keyword,
      secondaryKeywords: ['secundaria interna'],
      ogImageAlt: 'Alt público de la portada',
    },
    editorial: {
      ...EMPTY_EDITORIAL,
      reviewerId: CANARY.reviewer,
      reviewedAt: '2026-08-04T00:00:00.000Z',
      lastReviewedAt: '2026-08-04T12:00:00.000Z',
      claimsVerified: true,
      sourcesVerified: true,
      aiAssisted: true,
    },
    sources: [
      {
        id: 's-pub',
        title: 'Fuente pública verificada',
        url: 'https://www.inegi.org.mx/programas/ce/2024/',
        publisher: 'INEGI',
        sourceType: 'official',
        claimSupported: CANARY.claimInterno,
        accessedAt: '2026-08-04',
        verifiedByHuman: true,
      },
      {
        id: 's-priv',
        title: 'Fuente NO verificada',
        url: CANARY.unverifiedUrl,
        publisher: 'Pendiente',
        sourceType: 'reputable-secondary',
        claimSupported: 'claim sin verificar',
        accessedAt: '2026-08-04',
        verifiedByHuman: false,
      },
    ],
    internalLinks: [
      { targetUrl: '/pixelbot', anchor: 'anchor de planificación', placement: CANARY.placementInterno, verified: true },
      { targetUrl: 'https://pixeltec.mx/services/automatizacion', anchor: 'servicio absoluto', verified: true },
      { targetUrl: '/diagnostico', anchor: 'enlace NO verificado', verified: false },
      { targetUrl: 'https://example.com/externo', anchor: 'destino externo', verified: true },
    ],
    wordCount: 100,
    readingTimeMin: 3,
    createdAt: '2026-08-04T00:00:00.000Z',
    updatedAt: '2026-08-04T00:00:00.000Z',
    publishedAt: '2026-08-04T01:00:00.000Z',
    // WO-2026-00088 (paridad Encino) — FAQ, etiquetas y Maps SÍ se renderizan
    // en la página pública, así que son públicos por definición; un item con
    // pregunta o respuesta vacía se descarta.
    faq: [
      { question: '¿Cuánto cuesta?', answer: 'Depende del alcance.' },
      { question: '', answer: 'se descarta por pregunta vacía' },
      { question: 'se descarta por respuesta vacía', answer: '' },
    ],
    scheduledAt: null,
    mapsEmbed: 'https://www.google.com/maps/embed?pb=publico',
    aiParams: {
      brief: CANARY.aiParamsBrief,
      tone: 'educativo',
      audience: 'pymes',
      internalLinkCount: 2,
      externalLinkCount: 1,
    },
    approvedBy: 'uid-aprobador-interno',
  };
}

describe('toPublicBlogPost — contrato público con allowlist', () => {
  it('los campos públicos llegan completos', () => {
    const dto = toPublicBlogPost(fullPost());
    expect(dto.slug).toBe('articulo-de-prueba');
    expect(dto.title).toContain('Artículo de prueba');
    expect(dto.body).toBe('Cuerpo público del artículo.');
    expect(dto.coverAlt).toBe('Alt público de la portada');
    expect(dto.authorName).toBe('Miguel Robles');
    expect(dto.lastReviewedAt).toBe('2026-08-04T12:00:00.000Z');
    expect(dto.readingTimeMin).toBe(3);
  });

  it('Object.keys es EXACTAMENTE la allowlist (nada extra en runtime)', () => {
    const dto = toPublicBlogPost(fullPost());
    // WO-2026-00088 (paridad Encino): `faq`, `tags` y `mapsEmbed` se agregan a
    // la allowlist porque la página los RENDERIZA — son públicos por
    // definición, igual que `internalLinks` ya lo era desde 2026-08-05.
    // `aiParams` (brief crudo del wizard) NO se agrega: sigue sin cruzar,
    // como `briefSource`.
    expect(Object.keys(dto).sort()).toEqual([
      'authorName', 'body', 'category', 'coverAlt', 'coverImage', 'faq', 'internalLinks',
      'lastReviewedAt', 'mapsEmbed', 'publishedAt', 'readingTimeMin', 'slug', 'sources',
      'tags', 'title',
    ]);
    for (const s of dto.sources) {
      expect(Object.keys(s).sort()).toEqual(['accessedAt', 'publisher', 'title', 'url']);
    }
    for (const l of dto.internalLinks) {
      expect(Object.keys(l).sort()).toEqual(['anchor', 'targetUrl']);
    }
  });

  it('NINGÚN canary interno sobrevive a la serialización (prueba negativa runtime)', () => {
    const wire = JSON.stringify(toPublicBlogPost(fullPost()));
    for (const value of Object.values(CANARY)) {
      expect(wire).not.toContain(value);
    }
    expect(wire).not.toContain('uid-interno-secreto');
    expect(wire).not.toContain('uid-aprobador-interno');
    expect(wire).not.toContain('id-interno-xyz');
    expect(wire).not.toContain('briefSource');
    expect(wire).not.toContain('reviewerId');
    expect(wire).not.toContain('claimsVerified');
    // Evolución 2026-08-05 (estrategia de enlazado interno): `internalLinks`
    // SÍ cruza, pero solo {targetUrl, anchor} de enlaces verificados e
    // internos — placement/verified siguen siendo internos (canary arriba).
    expect(wire).not.toContain('placement');
    expect(wire).not.toContain('"verified"');
    expect(wire).not.toContain(CANARY.aiParamsBrief);
    expect(wire).not.toContain('aiParams');
  });

  it('enlazado interno: solo verificados e internos, absolutos normalizados a relativos', () => {
    const dto = toPublicBlogPost(fullPost());
    expect(dto.internalLinks).toEqual([
      { targetUrl: '/pixelbot', anchor: 'anchor de planificación' },
      { targetUrl: '/services/automatizacion', anchor: 'servicio absoluto' },
    ]);
    const wire = JSON.stringify(dto.internalLinks);
    expect(wire).not.toContain('example.com');
    expect(wire).not.toContain('NO verificado');
  });

  it('solo las fuentes verificadas se publican, y sin claimSupported', () => {
    const dto = toPublicBlogPost(fullPost());
    expect(dto.sources).toHaveLength(1);
    expect(dto.sources[0].url).toContain('inegi.org.mx');
    expect(JSON.stringify(dto.sources)).not.toContain('verificar');
  });

  it('FAQ, etiquetas y Maps embed cruzan tal cual; los items de FAQ vacíos se descartan', () => {
    const dto = toPublicBlogPost(fullPost());
    expect(dto.faq).toEqual([{ question: '¿Cuánto cuesta?', answer: 'Depende del alcance.' }]);
    expect(dto.tags).toEqual(['prueba']);
    expect(dto.mapsEmbed).toBe('https://www.google.com/maps/embed?pb=publico');
  });

  it('post viejo con capas vacías no lanza y produce DTO válido', () => {
    const p = fullPost();
    p.editorial = { ...EMPTY_EDITORIAL };
    p.sources = [];
    p.seo = { ...EMPTY_SEO, noindex: false };
    p.internalLinks = [];
    p.faq = [];
    p.mapsEmbed = null;
    p.tags = [];
    const dto: PublicBlogPost = toPublicBlogPost(p);
    expect(dto.coverAlt).toBe('');
    expect(dto.lastReviewedAt).toBeNull();
    expect(dto.sources).toEqual([]);
    expect(dto.internalLinks).toEqual([]);
    expect(dto.faq).toEqual([]);
    expect(dto.mapsEmbed).toBeNull();
    expect(dto.tags).toEqual([]);
  });
});
