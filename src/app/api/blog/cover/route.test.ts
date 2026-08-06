import { describe, expect, test, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

/**
 * Subida de portada (B-PR5): admin-only, MIME cerrado (sin SVG), límite 5MB
 * y magic bytes verificados — el MIME declarado por el cliente no basta.
 */

const { requireAdminMock, resolvePostRowMock, uploadObjectMock, deleteObjectMock, updateWhereMock, logMock } =
  vi.hoisted(() => ({
    requireAdminMock: vi.fn(),
    resolvePostRowMock: vi.fn(),
    uploadObjectMock: vi.fn(async () => 'https://cdn.example.com/blog/covers/nueva.png'),
    deleteObjectMock: vi.fn(async () => undefined),
    updateWhereMock: vi.fn(async () => undefined),
    logMock: vi.fn(async () => undefined),
  }));

vi.mock('@/lib/auth-guards', () => ({ requireAdmin: requireAdminMock }));
vi.mock('@/lib/blog/pg', () => ({
  resolvePostRow: resolvePostRowMock,
  getUserDisplayName: vi.fn(async () => 'Miguel'),
}));
vi.mock('@/lib/blog/activity', () => ({ logBlogActivity: logMock }));
vi.mock('@/lib/r2/upload', () => ({ uploadObject: uploadObjectMock, deleteObject: deleteObjectMock }));
vi.mock('@/lib/db', () => ({
  db: { update: vi.fn(() => ({ set: vi.fn(() => ({ where: updateWhereMock })) })) },
}));
vi.mock('@/lib/db/schema', () => ({ blogPosts: { id: {}, coverImage: {} } }));

import { POST } from './route';

const PNG_MAGIC = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const JPEG_MAGIC = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);

function makeReq(opts: { file?: File; postId?: string }): NextRequest {
  const form = new FormData();
  if (opts.postId !== undefined) form.set('postId', opts.postId);
  if (opts.file) form.set('file', opts.file);
  return new Request('http://localhost/api/blog/cover', {
    method: 'POST',
    body: form,
  }) as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminMock.mockResolvedValue({ ok: true, uid: 'admin-uid', isAdmin: true });
  resolvePostRowMock.mockResolvedValue({ id: 'post-uuid-1', coverImage: null });
  uploadObjectMock.mockResolvedValue('https://cdn.example.com/blog/covers/nueva.png');
});

describe('POST /api/blog/cover', () => {
  test('sin sesión admin → status del guard (401) sin tocar R2', async () => {
    requireAdminMock.mockResolvedValueOnce({ ok: false, error: 'Unauthorized', status: 401 });
    const res = await POST(makeReq({ postId: 'p1', file: new File([PNG_MAGIC], 'a.png', { type: 'image/png' }) }));
    expect(res.status).toBe(401);
    expect(uploadObjectMock).not.toHaveBeenCalled();
  });

  test('MIME no permitido (svg) → 400', async () => {
    const res = await POST(
      makeReq({ postId: 'p1', file: new File(['<svg/>'], 'a.svg', { type: 'image/svg+xml' }) })
    );
    expect(res.status).toBe(400);
    expect(uploadObjectMock).not.toHaveBeenCalled();
  });

  test('magic bytes que no coinciden con el MIME declarado → 400', async () => {
    // Declara PNG pero el contenido es JPEG.
    const res = await POST(
      makeReq({ postId: 'p1', file: new File([JPEG_MAGIC], 'a.png', { type: 'image/png' }) })
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'El contenido del archivo no coincide con el tipo declarado' });
    expect(uploadObjectMock).not.toHaveBeenCalled();
  });

  test('archivo mayor a 5MB → 400', async () => {
    const big = new Uint8Array(5 * 1024 * 1024 + 1);
    big.set(PNG_MAGIC);
    const res = await POST(makeReq({ postId: 'p1', file: new File([big], 'a.png', { type: 'image/png' }) }));
    expect(res.status).toBe(400);
    expect(uploadObjectMock).not.toHaveBeenCalled();
  });

  test('sin postId o sin file → 400', async () => {
    const sinFile = await POST(makeReq({ postId: 'p1' }));
    expect(sinFile.status).toBe(400);
    const sinPost = await POST(makeReq({ file: new File([PNG_MAGIC], 'a.png', { type: 'image/png' }) }));
    expect(sinPost.status).toBe(400);
  });

  test('post inexistente → 404', async () => {
    resolvePostRowMock.mockResolvedValueOnce(null);
    const res = await POST(makeReq({ postId: 'no-existe', file: new File([PNG_MAGIC], 'a.png', { type: 'image/png' }) }));
    expect(res.status).toBe(404);
    expect(uploadObjectMock).not.toHaveBeenCalled();
  });

  test('subida válida → sube a blog/covers/{id}-{hash}.png, actualiza y responde {ok,url}', async () => {
    const res = await POST(makeReq({ postId: 'p1', file: new File([PNG_MAGIC], 'a.png', { type: 'image/png' }) }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, url: 'https://cdn.example.com/blog/covers/nueva.png' });
    const [key, , contentType] = uploadObjectMock.mock.calls[0] as unknown as [string, Buffer, string];
    expect(key).toMatch(/^blog\/covers\/post-uuid-1-[0-9a-f]{8}\.png$/);
    expect(contentType).toBe('image/png');
    expect(updateWhereMock).toHaveBeenCalledTimes(1);
    expect(logMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'editado', message: 'Portada subida' }));
    expect(deleteObjectMock).not.toHaveBeenCalled(); // sin portada anterior en R2
  });

  test('portada anterior en blog/covers/ → borra la key vieja antes de subir', async () => {
    resolvePostRowMock.mockResolvedValueOnce({
      id: 'post-uuid-1',
      coverImage: 'https://cdn.example.com/blog/covers/post-uuid-1-deadbeef.jpg',
    });
    const res = await POST(makeReq({ postId: 'p1', file: new File([PNG_MAGIC], 'a.png', { type: 'image/png' }) }));
    expect(res.status).toBe(200);
    expect(deleteObjectMock).toHaveBeenCalledWith('blog/covers/post-uuid-1-deadbeef.jpg');
  });

  test('portada anterior externa (Unsplash) → NO se intenta borrar de R2', async () => {
    resolvePostRowMock.mockResolvedValueOnce({
      id: 'post-uuid-1',
      coverImage: 'https://images.unsplash.com/photo-123',
    });
    const res = await POST(makeReq({ postId: 'p1', file: new File([PNG_MAGIC], 'a.png', { type: 'image/png' }) }));
    expect(res.status).toBe(200);
    expect(deleteObjectMock).not.toHaveBeenCalled();
  });
});
