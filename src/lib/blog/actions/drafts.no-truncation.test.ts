import { describe, expect, test, vi, beforeEach } from 'vitest';

/**
 * Anti-truncado (SEO-BLOG-020): título y extracto generados se persisten
 * COMPLETOS en seo.metaTitle / metaDescription / ogImageAlt. Los `.slice()`
 * silenciosos producían <title> cortados a media palabra ("…atien"); ahora el
 * largo lo advierte el gate de publicación y decide el humano.
 */

const { sessionMock, resolveBriefRowMock, generatePostFromBriefMock, insertedValues } = vi.hoisted(() => ({
  sessionMock: vi.fn(),
  resolveBriefRowMock: vi.fn(),
  generatePostFromBriefMock: vi.fn(),
  insertedValues: { current: null as Record<string, unknown> | null },
}));

vi.mock('@/lib/auth/session', () => ({ requireUserSession: sessionMock }));
vi.mock('@/lib/db', () => ({
  db: {
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
    insert: vi.fn(() => ({
      values: vi.fn((v: Record<string, unknown>) => {
        insertedValues.current = v;
        return { returning: vi.fn(async () => [{ id: 'post-row-1' }]) };
      }),
    })),
  },
}));
vi.mock('@/lib/db/schema', () => ({ blogBriefs: { data: {} }, blogPosts: { id: {} } }));
vi.mock('../pg', () => ({
  resolveBriefRow: resolveBriefRowMock,
  resolvePostRow: vi.fn(),
  publicId: vi.fn(() => 'brief-1'),
  getUserDisplayName: vi.fn(async () => 'Miguel Robles'),
}));
vi.mock('../ai/generate-post', () => ({
  generatePostFromBrief: generatePostFromBriefMock,
  computeWordCount: vi.fn(() => 800),
  computeReadingTime: vi.fn(() => 4),
  generateSlug: vi.fn(() => 'titulo-largo'),
}));

import { generateDraft } from './drafts';

beforeEach(() => {
  vi.clearAllMocks();
  insertedValues.current = null;
  sessionMock.mockResolvedValue({ userId: 'user-1', email: 'staff@ejemplo.mx', role: 'staff' });
  resolveBriefRowMock.mockResolvedValue({ id: 'row-1', data: {}, createdAt: new Date('2026-01-01T00:00:00.000Z') });
});

describe('generateDraft — anti-truncado de SEO', () => {
  test('un título de 120 caracteres se persiste completo (metaTitle y ogImageAlt)', async () => {
    const title = 'x'.repeat(120);
    const excerpt = 'y'.repeat(200);
    generatePostFromBriefMock.mockResolvedValueOnce({
      title,
      excerpt,
      body: 'cuerpo '.repeat(100),
      category: 'automatización',
      tags: ['ia'],
      modelUsed: 'claude-test',
      rawOutput: 'raw',
    });

    const result = await generateDraft('brief-1');

    expect(result.ok).toBe(true);
    const seo = (insertedValues.current as { seo: Record<string, string | null> }).seo;
    expect(seo.metaTitle).toBe(title);
    expect(seo.ogImageAlt).toBe(title);
    expect(seo.metaDescription).toBe(excerpt);
  });
});
