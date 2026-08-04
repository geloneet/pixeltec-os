import { describe, expect, test, vi, beforeEach } from 'vitest';

/**
 * Beacon de visitas: validación estricta de entrada, solo posts publicados,
 * y fail-silent (un fallo de DB jamás rompe la respuesta ni filtra slugs).
 */

const { selectLimitMock, upsertMock } = vi.hoisted(() => ({
  selectLimitMock: vi.fn(),
  upsertMock: vi.fn(async () => undefined),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({ where: vi.fn(() => ({ limit: selectLimitMock })) })),
    })),
    insert: vi.fn(() => ({ values: vi.fn(() => ({ onConflictDoUpdate: upsertMock })) })),
  },
}));
vi.mock('@/lib/db/schema', () => ({
  blogPosts: { id: {}, slug: {}, status: {} },
  blogPostViewCounts: { postId: {}, views: {}, updatedAt: {} },
}));

import { db } from '@/lib/db';
import { POST } from './route';

function makeReq(body: unknown): Request {
  return new Request('http://localhost/api/blog/view', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  selectLimitMock.mockResolvedValue([]);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('POST /api/blog/view', () => {
  test('body que no es JSON → 400', async () => {
    const res = await POST(makeReq('esto no es json'));
    expect(res.status).toBe(400);
  });

  test('slug inválido → 400 sin tocar la DB', async () => {
    const res = await POST(makeReq({ slug: 'Slug Malo!' }));
    expect(res.status).toBe(400);
    expect(db.select).not.toHaveBeenCalled();
  });

  test('slug demasiado largo → 400', async () => {
    const res = await POST(makeReq({ slug: 'a'.repeat(200) }));
    expect(res.status).toBe(400);
  });

  test('slug válido pero no publicado → ok:true SIN incrementar (no filtra existencia)', async () => {
    selectLimitMock.mockResolvedValueOnce([]);
    const res = await POST(makeReq({ slug: 'no-existe' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(upsertMock).not.toHaveBeenCalled();
  });

  test('post publicado → incrementa una vez y responde ok', async () => {
    selectLimitMock.mockResolvedValueOnce([{ id: 'post-uuid-1' }]);
    const res = await POST(makeReq({ slug: 'agente-de-ia-en-whatsapp-para-mi-negocio' }));
    expect(res.status).toBe(200);
    expect(upsertMock).toHaveBeenCalledTimes(1);
  });

  test('fallo de DB → fail-silent: responde ok:true igual', async () => {
    selectLimitMock.mockRejectedValueOnce(new Error('db caida'));
    const res = await POST(makeReq({ slug: 'slug-valido' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
