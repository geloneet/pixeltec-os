import { describe, expect, test, vi, beforeEach } from 'vitest';

/**
 * Beacon de comportamiento: validación estricta, `post_id` solo para posts
 * publicados, cero PII persistida y fail-silent (un fallo de DB o de
 * configuración jamás rompe la navegación del visitante).
 *
 * Mismo patrón de mocks que `api/blog/view/route.test.ts`.
 */

const { selectLimitMock, insertValuesMock, onConflictMock, rateLimitMock, hashIpMock } = vi.hoisted(() => ({
  selectLimitMock: vi.fn(),
  insertValuesMock: vi.fn(),
  onConflictMock: vi.fn(async () => undefined),
  rateLimitMock: vi.fn(),
  hashIpMock: vi.fn(() => 'hash-de-la-ip'),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({ where: vi.fn(() => ({ limit: selectLimitMock })) })),
    })),
    insert: vi.fn(() => ({
      values: insertValuesMock.mockReturnValue({ onConflictDoNothing: onConflictMock }),
    })),
  },
}));
vi.mock('@/lib/db/schema', () => ({
  blogPosts: { id: {}, slug: {}, status: {} },
  contentEvents: {},
}));
vi.mock('@/lib/rate-limit', () => ({ enforceRateLimit: rateLimitMock }));
vi.mock('@/lib/privacy', () => ({ hashIp: hashIpMock }));

import { db } from '@/lib/db';
import { POST } from './route';

const SESSION = '3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

function makeReq(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/events', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function payload(over: Record<string, unknown> = {}) {
  return { sessionId: SESSION, path: '/blog/un-articulo', event: 'view', ...over };
}

beforeEach(() => {
  vi.clearAllMocks();
  selectLimitMock.mockResolvedValue([]);
  rateLimitMock.mockResolvedValue({ allowed: true, remaining: 100, retryAfterSec: 0 });
  hashIpMock.mockReturnValue('hash-de-la-ip');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('POST /api/events — validación', () => {
  test('body que no es JSON → 400', async () => {
    const res = await POST(makeReq('esto no es json'));
    expect(res.status).toBe(400);
  });

  test('session_id que no es uuid v4 → 400 sin tocar la DB', async () => {
    const res = await POST(makeReq(payload({ sessionId: 'no-soy-un-uuid' })));
    expect(res.status).toBe(400);
    expect(db.select).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  test('evento fuera del catálogo de cliente → 400', async () => {
    expect((await POST(makeReq(payload({ event: 'lead_created' })))).status).toBe(400);
    expect((await POST(makeReq(payload({ event: 'download_resource' })))).status).toBe(400);
  });

  test('meta inválido para el evento → 400', async () => {
    const res = await POST(makeReq(payload({ event: 'scroll', meta: { depth: 33 } })));
    expect(res.status).toBe(400);
  });

  test('path con query string → 400 (nunca se guarda un parámetro ajeno)', async () => {
    const res = await POST(makeReq(payload({ path: '/blog/x?email=alguien@ejemplo.mx' })));
    expect(res.status).toBe(400);
  });

  test('path que no es contenido → ok:true sin escribir (no delata qué rutas existen)', async () => {
    const res = await POST(makeReq(payload({ path: '/hoy' })));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(db.insert).not.toHaveBeenCalled();
  });
});

describe('POST /api/events — persistencia', () => {
  test('post publicado → guarda el evento con post_id', async () => {
    selectLimitMock.mockResolvedValueOnce([{ id: 'post-uuid-1' }]);
    const res = await POST(makeReq(payload({ event: 'scroll', meta: { depth: 75 } })));

    expect(res.status).toBe(200);
    expect(insertValuesMock).toHaveBeenCalledTimes(1);
    expect(insertValuesMock.mock.calls[0][0]).toMatchObject({
      sessionId: SESSION,
      path: '/blog/un-articulo',
      postId: 'post-uuid-1',
      event: 'scroll',
      meta: { depth: 75 },
    });
    // Sin `target`: el índice de dedupe es PARCIAL (42P10 si se infiriera).
    expect(onConflictMock).toHaveBeenCalledWith();
  });

  test('post NO publicado → guarda igual con post_id null (no se pierde el hecho)', async () => {
    selectLimitMock.mockResolvedValueOnce([]);
    await POST(makeReq(payload()));
    expect(insertValuesMock.mock.calls[0][0]).toMatchObject({ postId: null });
  });

  test('landing de keyword → guarda sin consultar blog_posts', async () => {
    await POST(makeReq(payload({ path: '/desarrollo-web-puerto-vallarta' })));
    expect(db.select).not.toHaveBeenCalled();
    expect(insertValuesMock.mock.calls[0][0]).toMatchObject({
      path: '/desarrollo-web-puerto-vallarta',
      postId: null,
    });
  });

  test('normaliza la barra final antes de guardar', async () => {
    selectLimitMock.mockResolvedValueOnce([{ id: 'post-uuid-1' }]);
    await POST(makeReq(payload({ path: '/blog/un-articulo/' })));
    expect(insertValuesMock.mock.calls[0][0]).toMatchObject({ path: '/blog/un-articulo' });
  });

  test('guarda ip_hash, NUNCA la IP cruda', async () => {
    await POST(makeReq(payload(), { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' }));
    const row = insertValuesMock.mock.calls[0][0] as Record<string, unknown>;
    expect(hashIpMock).toHaveBeenCalledWith('203.0.113.9');
    expect(row.ipHash).toBe('hash-de-la-ip');
    expect(JSON.stringify(row)).not.toContain('203.0.113.9');
  });
});

describe('POST /api/events — resiliencia', () => {
  test('rate limit excedido → ok:true sin escribir (no delata el límite)', async () => {
    rateLimitMock.mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfterSec: 600 });
    const res = await POST(makeReq(payload()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(db.insert).not.toHaveBeenCalled();
  });

  test('usa el bucket propio `events`', async () => {
    await POST(makeReq(payload()));
    expect(rateLimitMock.mock.calls[0][0]).toMatchObject({ bucket: 'events' });
  });

  test('fallo de DB → fail-silent: responde ok:true igual', async () => {
    selectLimitMock.mockRejectedValueOnce(new Error('db caida'));
    const res = await POST(makeReq(payload()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  test('INTERNAL_IP_SALT ausente (hashIp lanza) → ok:true, nunca 500', async () => {
    rateLimitMock.mockRejectedValueOnce(new Error('INTERNAL_IP_SALT is not configured'));
    const res = await POST(makeReq(payload()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
