import { describe, expect, it } from 'vitest';
import type { BlogBriefSerialized, BlogPostSerialized } from '@/lib/blog/types';
import {
  attentionCount,
  attentionSpotlight,
  briefIsIdea,
  briefNextAction,
  briefStatusLabel,
  editorialSummarySegments,
  filterBriefs,
  filterPosts,
  ideasCount,
  needsAttention,
  postDateInfo,
  postNextAction,
  postStatusClass,
  postStatusLabel,
} from './blog-admin-logic';

/** Post sintético mínimo — el resto de campos no participa en la lógica. */
function post(over: Partial<BlogPostSerialized>): BlogPostSerialized {
  return {
    id: 'p1',
    slug: 'un-slug',
    title: 'Un título',
    status: 'draft',
    wordCount: 100,
    readingTimeMin: 1,
    createdAt: '2026-08-01T12:00:00.000Z',
    updatedAt: '2026-08-01T12:00:00.000Z',
    publishedAt: null,
    ...over,
  } as BlogPostSerialized;
}

function brief(over: Partial<BlogBriefSerialized>): BlogBriefSerialized {
  return {
    id: 'b1',
    topic: 'Una idea',
    status: 'pending',
    generatedDraftId: null,
    createdAt: '2026-08-01T12:00:00.000Z',
    ...over,
  } as BlogBriefSerialized;
}

describe('postNextAction — acción contextual por estado real', () => {
  it.each([
    ['draft', 'Continuar'],
    ['needs-review', 'Revisar'],
    ['approved', 'Publicar'],
    ['archived', 'Ver'],
  ] as const)('%s → %s (editor)', (status, label) => {
    const a = postNextAction(post({ id: 'x9', status }));
    expect(a.label).toBe(label);
    expect(a.href).toBe('/blog-admin/x9/editar');
    expect(a.external).toBeUndefined();
  });

  it('published → Ver artículo (público, pestaña nueva)', () => {
    const a = postNextAction(post({ status: 'published', slug: 'mi-articulo' }));
    expect(a).toEqual({ label: 'Ver artículo', href: '/blog/mi-articulo', external: true });
  });

  it('estado desconocido degrada a Abrir (editor), sin romper', () => {
    const a = postNextAction(post({ status: 'estado-futuro' as BlogPostSerialized['status'] }));
    expect(a.label).toBe('Abrir');
    expect(a.href).toContain('/editar');
  });
});

describe('briefNextAction', () => {
  it('pending → generate', () => {
    expect(briefNextAction(brief({ status: 'pending' })).kind).toBe('generate');
  });
  it('generating → generating (deshabilitado en UI)', () => {
    expect(briefNextAction(brief({ status: 'generating' })).kind).toBe('generating');
  });
  it('generated CON borrador enlaza al post correcto', () => {
    const a = briefNextAction(brief({ status: 'generated', generatedDraftId: 'post-7' }));
    expect(a).toEqual({ kind: 'open', label: 'Abrir borrador', href: '/blog-admin/post-7/editar' });
  });
  it('generated SIN draftId y discarded → sin acción (no se inventan botones)', () => {
    expect(briefNextAction(brief({ status: 'generated', generatedDraftId: null })).kind).toBe('none');
    expect(briefNextAction(brief({ status: 'discarded' })).kind).toBe('none');
  });
});

describe('etiquetas de estado — degradación segura', () => {
  it('estados reales traducidos', () => {
    expect(postStatusLabel('needs-review')).toBe('En revisión');
    expect(briefStatusLabel('generated')).toBe('Generado');
  });
  it('estado desconocido: etiqueta cruda + clase neutra', () => {
    expect(postStatusLabel('limbo')).toBe('limbo');
    expect(postStatusClass('limbo')).toContain('bg-muted');
  });
});

describe('postDateInfo — etiqueta y TZ editorial', () => {
  it('publicado manda sobre actualizado', () => {
    const d = postDateInfo(post({
      status: 'published',
      publishedAt: '2026-08-04T01:58:00.000Z', // 19:58 del 3-ago en México
      updatedAt: '2026-08-04T15:00:00.000Z',
    }));
    expect(d.label).toBe('Publicado');
    expect(d.text).toBe('3 de agosto de 2026');
  });
  it('actualizado cuando difiere de creado', () => {
    const d = postDateInfo(post({ updatedAt: '2026-08-02T12:00:00.000Z' }));
    expect(d.label).toBe('Actualizado');
  });
  it('creado como último recurso', () => {
    expect(postDateInfo(post({})).label).toBe('Creado');
  });
});

describe('filterPosts — búsqueda, estado y orden', () => {
  const posts = [
    post({ id: 'a', title: 'Bot de WhatsApp para PyMEs', status: 'draft', updatedAt: '2026-08-03T00:00:00.000Z' }),
    post({ id: 'b', title: 'Agente de IA en WhatsApp', status: 'published', publishedAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' }),
    post({ id: 'c', title: 'Precios y costos reales', status: 'needs-review', updatedAt: '2026-08-02T00:00:00.000Z' }),
    post({ id: 'd', title: 'Post archivado viejo', status: 'archived', updatedAt: '2026-07-01T00:00:00.000Z' }),
  ];

  it('sin filtros devuelve todo, más reciente primero, sin duplicados', () => {
    const r = filterPosts(posts, { query: '', status: 'all', order: 'recent' });
    expect(r.map((p) => p.id)).toEqual(['a', 'c', 'b', 'd']);
    expect(new Set(r.map((p) => p.id)).size).toBe(r.length);
  });

  it('orden más antiguos invierte', () => {
    const r = filterPosts(posts, { query: '', status: 'all', order: 'oldest' });
    expect(r[0].id).toBe('d');
  });

  it('búsqueda por título (case-insensitive)', () => {
    const r = filterPosts(posts, { query: 'whatsapp', status: 'all', order: 'recent' });
    expect(r.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('búsqueda sin resultados devuelve vacío', () => {
    expect(filterPosts(posts, { query: 'inexistente-zzz', status: 'all', order: 'recent' })).toEqual([]);
  });

  it.each(['draft', 'needs-review', 'approved', 'published', 'archived'] as const)(
    'filtro por estado %s solo devuelve ese estado',
    (status) => {
      const r = filterPosts(posts, { query: '', status, order: 'recent' });
      expect(r.every((p) => p.status === status)).toBe(true);
    }
  );

  it('filtro active (predeterminado) excluye archivados y conserva el resto', () => {
    const r = filterPosts(posts, { query: '', status: 'active', order: 'recent' });
    expect(r.map((p) => p.id)).toEqual(['a', 'c', 'b']);
    expect(r.some((p) => p.status === 'archived')).toBe(false);
  });

  it('filtro attention = needs-review + approved', () => {
    const r = filterPosts([...posts, post({ id: 'e', status: 'approved' })], {
      query: '',
      status: 'attention',
      order: 'recent',
    });
    expect(r.map((p) => p.id).sort()).toEqual(['c', 'e']);
  });

  it('limpiar filtros restaura la lista completa', () => {
    const filtered = filterPosts(posts, { query: 'bot', status: 'draft', order: 'recent' });
    expect(filtered).toHaveLength(1);
    expect(filterPosts(posts, { query: '', status: 'all', order: 'recent' })).toHaveLength(posts.length);
  });
});

describe('filterBriefs — `all` = solo IDEAS (sin artículo generado)', () => {
  const briefs = [
    brief({ id: 'b1', topic: 'Reservas por WhatsApp', status: 'pending', createdAt: '2026-08-03T00:00:00.000Z' }),
    brief({ id: 'b2', topic: 'Inventario automático', status: 'generated', generatedDraftId: 'p9', createdAt: '2026-08-01T00:00:00.000Z' }),
    brief({ id: 'b3', topic: 'Huérfano sin borrador', status: 'generated', generatedDraftId: null, createdAt: '2026-08-02T00:00:00.000Z' }),
    brief({ id: 'b4', topic: 'Idea descartada', status: 'discarded', createdAt: '2026-07-30T00:00:00.000Z' }),
  ];
  it('all excluye los generated con borrador (viven dentro del artículo) y los descartados', () => {
    const r = filterBriefs(briefs, { query: '', status: 'all', order: 'recent' });
    expect(r.map((b) => b.id)).toEqual(['b1', 'b3']);
  });
  it('un generated huérfano sigue visible como idea — no se esconde trabajo', () => {
    expect(briefIsIdea(brief({ status: 'generated', generatedDraftId: null }))).toBe(true);
    expect(briefIsIdea(brief({ status: 'generated', generatedDraftId: 'p9' }))).toBe(false);
  });
  it('descartadas se consultan a demanda con su filtro explícito', () => {
    const r = filterBriefs(briefs, { query: '', status: 'discarded', order: 'recent' });
    expect(r.map((b) => b.id)).toEqual(['b4']);
  });
  it('búsqueda por tema dentro de ideas', () => {
    expect(filterBriefs(briefs, { query: 'reservas', status: 'all', order: 'recent' })).toHaveLength(1);
  });
  it('ideasCount coincide con el tab Ideas', () => {
    expect(ideasCount(briefs)).toBe(2);
  });
});

describe('resumen y atención', () => {
  const posts = [
    post({ status: 'published' }),
    post({ status: 'published' }),
    post({ status: 'draft' }),
    post({ status: 'needs-review' }),
    post({ status: 'approved' }),
    post({ status: 'archived' }),
  ];
  it('segmentos en español con total REAL, cada uno con su filtro (pulsable)', () => {
    const segs = editorialSummarySegments(posts);
    expect(segs.map((s) => `${s.count} ${s.label}`)).toEqual([
      '6 artículos',
      '2 publicados',
      '1 borrador',
      '1 en revisión',
      '1 archivado',
    ]);
    expect(segs.find((s) => s.key === 'total')?.filter).toBe('all');
    expect(segs.find((s) => s.key === 'review')?.filter).toBe('needs-review');
    expect(segs.find((s) => s.key === 'archived')?.filter).toBe('archived');
  });

  it('omite el segmento de archivados cuando no hay', () => {
    const segs = editorialSummarySegments(posts.filter((p) => p.status !== 'archived'));
    expect(segs.some((s) => s.key === 'archived')).toBe(false);
    expect(segs).toHaveLength(4);
  });

  it('attentionCount = needs-review + approved', () => {
    expect(attentionCount(posts)).toBe(2);
    expect(needsAttention(post({ status: 'draft' }))).toBe(false);
  });

  it('attentionSpotlight nombra al pendiente MÁS VIEJO (por fecha de trabajo)', () => {
    const list = [
      post({ id: 'n1', title: 'Nuevo en revisión', status: 'needs-review', updatedAt: '2026-08-04T00:00:00.000Z' }),
      post({ id: 'n2', title: 'Aprobado olvidado', status: 'approved', updatedAt: '2026-07-20T00:00:00.000Z' }),
      post({ id: 'n3', title: 'Borrador', status: 'draft', updatedAt: '2026-07-01T00:00:00.000Z' }),
    ];
    expect(attentionSpotlight(list)).toEqual({ id: 'n2', title: 'Aprobado olvidado' });
    expect(attentionSpotlight([post({ status: 'draft' })])).toBeNull();
  });
});
