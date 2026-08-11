import { beforeEach, describe, expect, test, vi } from 'vitest';

/**
 * Versionado de artículos (B-PR6): version=max+1 sobre el MISMO ejecutor,
 * restore con snapshot previo `pre-restauracion` y la regla dura de que
 * restaurar JAMÁS toca `status` ni `slug`. Todo con db mockeada.
 */

const { dbMock, insertValuesMock, updateSetMock, selectQueue, logBlogActivityMock } = vi.hoisted(() => {
  const insertValuesMock = vi.fn(async (_values: Record<string, unknown>) => undefined);
  const updateSetMock = vi.fn((_payload: Record<string, unknown>) => ({
    where: vi.fn(async () => undefined),
  }));
  const selectQueue: unknown[] = [];

  // Cadena flexible: from/where/orderBy/limit devuelven la propia cadena y el
  // await resuelve el siguiente resultado encolado.
  function chain(result: unknown) {
    const c: Record<string, unknown> = {};
    c.from = () => c;
    c.where = () => c;
    c.orderBy = () => c;
    c.limit = () => c;
    c.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
      Promise.resolve(result).then(res, rej);
    return c;
  }

  const dbMock: Record<string, unknown> = {
    select: vi.fn(() => chain(selectQueue.shift() ?? [])),
    insert: vi.fn(() => ({ values: insertValuesMock })),
    update: vi.fn(() => ({ set: updateSetMock })),
  };
  // La transacción reusa el mismo mock como `tx`.
  dbMock.transaction = vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(dbMock));

  return { dbMock, insertValuesMock, updateSetMock, selectQueue, logBlogActivityMock: vi.fn() };
});

vi.mock('@/lib/db', () => ({ db: dbMock }));
vi.mock('./activity', () => ({ logBlogActivity: logBlogActivityMock }));

import { snapshotPost, restoreVersion, type DbExecutor } from './versions';

const dbx = dbMock as unknown as DbExecutor;

const POST_ROW = {
  id: 'post-uuid',
  firestoreId: null,
  slug: 'slug-original',
  title: 'Título actual',
  category: 'arquitectura',
  excerpt: 'Extracto actual',
  body: 'Cuerpo actual con varias palabras de contenido',
  tags: ['a', 'b'],
  coverImage: 'https://img/actual.jpg',
  author: { name: 'Miguel', uid: 'u1' },
  status: 'needs-review',
  briefSource: { topic: 't' },
  ai: { model: 'm', iterations: 2 },
  seo: { metaTitle: 'MT' },
  editorial: { reviewerId: 'u1' },
  sources: [{ id: 's1' }],
  internalLinks: [{ targetUrl: '/x' }],
  wordCount: 7,
  readingTimeMin: 1,
  approvedBy: null,
  publishedAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
} as any;

const VERSION_ROW = {
  id: 'version-uuid',
  postId: 'post-uuid',
  version: 4,
  reason: 'pre-regeneracion-ia',
  title: 'Título viejo',
  excerpt: 'Extracto viejo',
  body: 'Cuerpo viejo',
  slug: 'slug-viejo-que-no-debe-restaurarse',
  category: 'opinión',
  tags: ['z'],
  coverImage: null,
  seo: { metaTitle: 'Viejo' },
  editorial: { reviewerId: 'u9' },
  sources: [],
  internalLinks: [],
  ai: { iterations: 1 },
  createdById: 'u1',
  createdByName: 'Miguel',
  createdAt: new Date('2026-01-01T12:00:00Z'),
} as any;

const ACTOR = { id: 'u1', name: 'Miguel' };

beforeEach(() => {
  vi.clearAllMocks();
  selectQueue.length = 0;
});

describe('snapshotPost — version = max+1 en el mismo ejecutor', () => {
  test('con versiones previas: max 3 → inserta la 4', async () => {
    selectQueue.push([{ max: 3 }]);

    const version = await snapshotPost(dbx, POST_ROW, 'manual', ACTOR);

    expect(version).toBe(4);
    expect(insertValuesMock).toHaveBeenCalledTimes(1);
    const values = insertValuesMock.mock.calls[0][0];
    expect(values.postId).toBe('post-uuid');
    expect(values.version).toBe(4);
    expect(values.reason).toBe('manual');
    expect(values.title).toBe('Título actual');
    expect(values.slug).toBe('slug-original');
    expect(values.createdById).toBe('u1');
    expect(values.createdByName).toBe('Miguel');
  });

  test('sin versiones previas (max NULL) → inserta la 1', async () => {
    selectQueue.push([{ max: null }]);

    const version = await snapshotPost(dbx, POST_ROW, 'publicacion', ACTOR);

    expect(version).toBe(1);
    const values = insertValuesMock.mock.calls[0][0];
    expect(values.version).toBe(1);
    expect(values.reason).toBe('publicacion');
  });
});

describe('restoreVersion — snapshot previo y regla dura status/slug', () => {
  test('snapshotea `pre-restauracion` ANTES y el update no toca status ni slug', async () => {
    selectQueue.push([POST_ROW]); // post actual
    selectQueue.push([VERSION_ROW]); // versión a restaurar
    selectQueue.push([{ max: 5 }]); // max dentro de la tx (snapshot previo)

    const result = await restoreVersion('post-uuid', 'version-uuid', ACTOR);

    expect(result).toEqual({ restoredVersion: 4 });

    // Snapshot previo del contenido ACTUAL con reason pre-restauracion.
    expect(insertValuesMock).toHaveBeenCalledTimes(1);
    const snapshot = insertValuesMock.mock.calls[0][0];
    expect(snapshot.reason).toBe('pre-restauracion');
    expect(snapshot.version).toBe(6);
    expect(snapshot.title).toBe('Título actual');

    // Update: restaura contenido, JAMÁS status ni slug.
    expect(updateSetMock).toHaveBeenCalledTimes(1);
    const payload = updateSetMock.mock.calls[0][0];
    expect(payload).not.toHaveProperty('status');
    expect(payload).not.toHaveProperty('slug');
    expect(payload.title).toBe('Título viejo');
    expect(payload.body).toBe('Cuerpo viejo');
    expect(payload.category).toBe('opinión');
    expect(payload.tags).toEqual(['z']);

    // Actividad registrada.
    expect(logBlogActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'version-restaurada', postId: 'post-uuid' })
    );
  });

  test('rechaza una versión que pertenece a OTRO post', async () => {
    selectQueue.push([POST_ROW]);
    selectQueue.push([{ ...VERSION_ROW, postId: 'otro-post' }]);

    await expect(restoreVersion('post-uuid', 'version-uuid', ACTOR)).rejects.toThrow(
      'Versión no encontrada'
    );
    expect(updateSetMock).not.toHaveBeenCalled();
    expect(insertValuesMock).not.toHaveBeenCalled();
  });
});
