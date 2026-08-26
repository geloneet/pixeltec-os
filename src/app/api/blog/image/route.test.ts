import { describe, expect, test, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

/**
 * Imagen del cuerpo del artículo (WO-2026-00088): admin-only, MIME cerrado
 * (sin SVG), 5MB, magic bytes — mismo endurecimiento que /api/blog/cover.
 */

const { requireAdminMock, resolvePostRowMock, uploadObjectMock } = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  resolvePostRowMock: vi.fn(),
  uploadObjectMock: vi.fn(async () => 'https://cdn.example.com/blog/images/post-1/hash.png'),
}));

vi.mock('@/lib/auth-guards', () => ({ requireAdmin: requireAdminMock }));
vi.mock('@/lib/blog/pg', () => ({ resolvePostRow: resolvePostRowMock }));
vi.mock('@/lib/r2/upload', () => ({ uploadObject: uploadObjectMock }));

import { POST } from './route';

const PNG_MAGIC = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const JPEG_MAGIC = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);

function makeReq(opts: { file?: File; postId?: string }): NextRequest {
  const form = new FormData();
  if (opts.postId !== undefined) form.set('postId', opts.postId);
  if (opts.file) form.set('file', opts.file);
  return new Request('http://localhost/api/blog/image', { method: 'POST', body: form }) as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminMock.mockResolvedValue({ ok: true, uid: 'admin-uid', isAdmin: true });
  resolvePostRowMock.mockResolvedValue({ id: 'post-uuid-1' });
  uploadObjectMock.mockResolvedValue('https://cdn.example.com/blog/images/post-1/hash.png');
});

describe('POST /api/blog/image', () => {
  test('sin sesión admin → status del guard, sin tocar R2', async () => {
    requireAdminMock.mockResolvedValueOnce({ ok: false, error: 'Unauthorized', status: 401 });
    const res = await POST(makeReq({ postId: 'p1', file: new File([PNG_MAGIC], 'a.png', { type: 'image/png' }) }));
    expect(res.status).toBe(401);
    expect(uploadObjectMock).not.toHaveBeenCalled();
  });

  test('SVG no permitido → 400', async () => {
    const res = await POST(makeReq({ postId: 'p1', file: new File(['<svg/>'], 'a.svg', { type: 'image/svg+xml' }) }));
    expect(res.status).toBe(400);
    expect(uploadObjectMock).not.toHaveBeenCalled();
  });

  test('magic bytes que no coinciden con el MIME declarado → 400', async () => {
    const res = await POST(makeReq({ postId: 'p1', file: new File([JPEG_MAGIC], 'a.png', { type: 'image/png' }) }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'El contenido del archivo no coincide con el tipo declarado' });
  });

  test('archivo mayor a 5MB → 400', async () => {
    const big = new Uint8Array(5 * 1024 * 1024 + 1);
    big.set(PNG_MAGIC);
    const res = await POST(makeReq({ postId: 'p1', file: new File([big], 'a.png', { type: 'image/png' }) }));
    expect(res.status).toBe(400);
  });

  test('post inexistente → 404, sin subir', async () => {
    resolvePostRowMock.mockResolvedValueOnce(null);
    const res = await POST(makeReq({ postId: 'nope', file: new File([PNG_MAGIC], 'a.png', { type: 'image/png' }) }));
    expect(res.status).toBe(404);
    expect(uploadObjectMock).not.toHaveBeenCalled();
  });

  test('feliz camino: sube a blog/images/<postId>/ y devuelve la URL', async () => {
    const res = await POST(makeReq({ postId: 'p1', file: new File([PNG_MAGIC], 'a.png', { type: 'image/png' }) }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, url: 'https://cdn.example.com/blog/images/post-1/hash.png' });
    const [key] = uploadObjectMock.mock.calls[0] as unknown as [string, Buffer, string];
    expect(key).toMatch(/^blog\/images\/post-uuid-1\/[0-9a-f]{12}\.png$/);
  });
});
